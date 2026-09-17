import L from 'leaflet';
import 'leaflet.markercluster';
import { feature } from 'topojson-client';
import worldTopology from 'world-atlas/countries-110m.json';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '../styles.css';

import { startups } from './data/startups.js';
import { validateStartupDataset } from './data/schema.js';
import { buildStartupUrl, filterStartups, getStartupSlugFromUrl, uniqueSorted } from './lib/discovery.js';
import { buildCorrectionIssueUrl, buildSubmissionIssueUrl } from './lib/issues.js';

const validationErrors = validateStartupDataset(startups);
if (validationErrors.length > 0) throw new Error(`Invalid startup dataset: ${validationErrors.join(' ')}`);

const startupBySlug = new Map(startups.map((startup) => [startup.slug, startup]));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileLayout = window.matchMedia('(max-width: 720px)');
const identityPalette = ['#47d7db', '#c7ff4a', '#ff735f', '#f4bb45', '#a486ff', '#61a8ff'];
const countryPalette = ['#173c4a', '#273d59', '#3d3156', '#493443', '#3e4325', '#17463e', '#4a3824'];
const regionLabels = [
  ['North America', 45, -102],
  ['Latin America', -16, -61],
  ['Europe', 54, 15],
  ['Africa', 8, 20],
  ['Middle East', 28, 47],
  ['South Asia', 19, 78],
  ['Southeast Asia', 7, 112],
  ['Oceania', -26, 137],
];
const worldCountries = unwrapAntimeridian(feature(worldTopology, worldTopology.objects.countries));

const elements = {
  canonicalLink: document.querySelector('#canonical-link'),
  startupTotal: document.querySelector('#startup-total'),
  countryTotal: document.querySelector('#country-total'),
  regionTotal: document.querySelector('#region-total'),
  discoveryPanel: document.querySelector('.discovery-panel'),
  discoveryBody: document.querySelector('#discovery-body'),
  mobileResultsToggle: document.querySelector('#mobile-results-toggle'),
  mobileResultCount: document.querySelector('#mobile-result-count'),
  mapCoordinates: document.querySelector('.map-coordinates'),
  search: document.querySelector('#search'),
  sectorFilter: document.querySelector('#sector-filter'),
  regionFilter: document.querySelector('#region-filter'),
  resetFilters: document.querySelector('#reset-filters'),
  emptyReset: document.querySelector('#empty-reset'),
  resultCount: document.querySelector('#result-count'),
  startupList: document.querySelector('#startup-list'),
  emptyState: document.querySelector('#empty-state'),
  mapStatus: document.querySelector('#map-status'),
  retryMap: document.querySelector('#retry-map'),
  profileDialog: document.querySelector('#profile-dialog'),
  profileMonogram: document.querySelector('#profile-monogram'),
  profileName: document.querySelector('#profile-name'),
  profileSector: document.querySelector('#profile-sector'),
  profileLocation: document.querySelector('#profile-location'),
  profileDescription: document.querySelector('#profile-description'),
  profileWebsite: document.querySelector('#profile-website'),
  profileVerified: document.querySelector('#profile-verified'),
  profileSources: document.querySelector('#profile-sources'),
  correctionLink: document.querySelector('#correction-link'),
  copyLink: document.querySelector('#copy-link'),
  shareProfile: document.querySelector('#share-profile'),
  shareStatus: document.querySelector('#share-status'),
  shareFallback: document.querySelector('#share-fallback'),
  shareUrl: document.querySelector('#share-url'),
  methodologyDialog: document.querySelector('#methodology-dialog'),
  submitDialog: document.querySelector('#submit-dialog'),
  submitForm: document.querySelector('#submit-form'),
  submitStatus: document.querySelector('#submit-status'),
  submitFallback: document.querySelector('#submit-fallback'),
};

const state = {
  query: '',
  sector: 'All sectors',
  region: 'All regions',
  selectedSlug: '',
  profileEntryPushed: false,
  resultsExpanded: true,
};

const dialogInvokers = new WeakMap();
const markers = new Map();
let map;
let clusterGroup;

function createElement(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function stableHash(value) {
  return [...String(value)].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function colorFor(value, palette = identityPalette) {
  return palette[stableHash(value) % palette.length];
}

function initialsFor(name) {
  const words = String(name).toUpperCase().match(/[A-Z0-9]+/g) || ['?'];
  return words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0].slice(0, 2);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function unwrapRing(ring) {
  let previousLongitude = ring[0]?.[0] ?? 0;
  return ring.map((coordinate, index) => {
    let longitude = coordinate[0];
    if (index > 0) {
      while (longitude - previousLongitude > 180) longitude -= 360;
      while (longitude - previousLongitude < -180) longitude += 360;
    }
    previousLongitude = longitude;
    return [longitude, ...coordinate.slice(1)];
  });
}

function unwrapAntimeridian(geoJson) {
  return {
    ...geoJson,
    features: geoJson.features.map((country) => ({
      ...country,
      geometry: {
        ...country.geometry,
        coordinates: country.geometry.type === 'Polygon'
          ? country.geometry.coordinates.map(unwrapRing)
          : country.geometry.coordinates.map((polygon) => polygon.map(unwrapRing)),
      },
    })),
  };
}

function populateSelect(select, options) {
  const fragment = document.createDocumentFragment();
  for (const value of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    fragment.append(option);
  }
  select.append(fragment);
}

function currentFilters() {
  return { query: state.query, sector: state.sector, region: state.region };
}

function hasActiveFilters() {
  return Boolean(state.query || state.sector !== 'All sectors' || state.region !== 'All regions');
}

function setResultsExpanded(expanded, { moveFocus = false } = {}) {
  state.resultsExpanded = expanded;
  if (!expanded && moveFocus && elements.discoveryBody.contains(document.activeElement)) {
    elements.mobileResultsToggle.focus();
  }
  elements.discoveryPanel.classList.toggle('is-collapsed', !expanded);
  elements.mobileResultsToggle.setAttribute('aria-expanded', String(expanded));
  requestAnimationFrame(() => map?.invalidateSize({ pan: false }));
}

function resetFilters() {
  state.query = '';
  state.sector = 'All sectors';
  state.region = 'All regions';
  elements.search.value = '';
  elements.sectorFilter.value = state.sector;
  elements.regionFilter.value = state.region;
  setResultsExpanded(true);
  renderDiscovery({ fitMap: true });
  elements.search.focus();
}

function createStartupCard(startup) {
  const item = document.createElement('li');
  const button = createElement('button', 'startup-card');
  const identityColor = colorFor(startup.sector);
  button.type = 'button';
  button.dataset.slug = startup.slug;
  button.style.setProperty('--identity-color', identityColor);
  button.setAttribute('aria-label', `Open ${startup.name}, ${startup.city}, ${startup.country}`);
  button.setAttribute('aria-current', String(state.selectedSlug === startup.slug));

  const initials = createElement('span', 'startup-initials', initialsFor(startup.name));
  initials.setAttribute('aria-hidden', 'true');
  const copy = createElement('span', 'startup-card-copy');
  const heading = createElement('h3', '', startup.name);
  const meta = createElement('p', '', `${startup.city}, ${startup.country}`);
  meta.append(createElement('span', 'card-sector', startup.sector));
  copy.append(heading, meta);

  button.append(initials, copy, createElement('span', 'card-arrow', '↗'));
  button.addEventListener('click', () => openProfile(startup.slug, { updateUrl: true, focusMap: true, invoker: button }));
  item.append(button);
  return item;
}

function renderDiscovery({ fitMap = false } = {}) {
  const visible = filterStartups(startups, currentFilters());
  const fragment = document.createDocumentFragment();
  visible.forEach((startup) => fragment.append(createStartupCard(startup)));
  elements.startupList.replaceChildren(fragment);
  elements.resultCount.textContent = `${visible.length} ${visible.length === 1 ? 'startup' : 'startups'}`;
  elements.mobileResultCount.textContent = `${visible.length} ${visible.length === 1 ? 'result' : 'results'}`;
  elements.resetFilters.disabled = !hasActiveFilters();
  elements.emptyState.hidden = visible.length > 0;
  elements.startupList.hidden = visible.length === 0;
  updateMapMarkers(visible, fitMap);
}

function createMarkerIcon(startup, selected = false) {
  const identityColor = colorFor(startup.sector);
  return L.divIcon({
    className: 'startup-marker-wrap',
    html: `<span class="startup-marker${selected ? ' is-selected' : ''}" style="--marker-color:${identityColor}" aria-hidden="true"><span class="marker-monogram">${escapeHtml(initialsFor(startup.name))}</span></span>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  return L.divIcon({
    className: 'marker-cluster cluster-shell',
    html: `<span class="cluster-badge" aria-hidden="true">${count}</span>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

function makeTooltip(startup) {
  const tooltip = createElement('span', 'startup-tooltip');
  tooltip.textContent = `${startup.name} · ${startup.city}`;
  return tooltip;
}

function configureMarkerElement(marker, startup) {
  const markerElement = marker.getElement();
  if (!markerElement) return;
  markerElement.setAttribute('role', 'button');
  markerElement.setAttribute('aria-label', `Open profile for ${startup.name} in ${startup.city}, ${startup.country}`);
  markerElement.setAttribute('title', `${startup.name} — ${startup.city}, ${startup.country}`);
  if (!markerElement.dataset.spaceHandler) {
    markerElement.dataset.spaceHandler = 'true';
    markerElement.addEventListener('keydown', (event) => {
      if (event.key === ' ') {
        event.preventDefault();
        openProfile(startup.slug, { updateUrl: true, focusMap: false, invoker: markerElement });
      }
    });
  }
}

function configureClusterElements() {
  document.querySelectorAll('.marker-cluster').forEach((cluster) => {
    const count = cluster.textContent.trim();
    cluster.setAttribute('role', 'button');
    cluster.setAttribute('aria-label', `${count} startup locations; zoom to expand`);
    cluster.setAttribute('title', `${count} startup locations — zoom to expand`);
  });
}

function addRegionLabels() {
  for (const [label, latitude, longitude] of regionLabels) {
    L.marker([latitude, longitude], {
      pane: 'labels',
      interactive: false,
      icon: L.divIcon({
        className: 'region-label-wrap',
        html: `<span class="region-label">${escapeHtml(label)}</span>`,
        iconSize: [140, 20],
        iconAnchor: [70, 10],
      }),
    }).addTo(map);
  }
}

function updateCoordinateReadout() {
  if (!map) return;
  const center = map.getCenter();
  const latitude = `${Math.abs(Math.round(center.lat))}°${center.lat >= 0 ? 'N' : 'S'}`;
  const longitude = `${Math.abs(Math.round(center.lng))}°${center.lng >= 0 ? 'E' : 'W'}`;
  elements.mapCoordinates.textContent = `${latitude} / ${longitude}`;
}

function initializeMap() {
  try {
    map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      minZoom: mobileLayout.matches ? 1 : 2,
      maxZoom: 18,
      maxBounds: [[-85, -210], [85, 210]],
      maxBoundsViscosity: 0.7,
    }).setView([18, 8], mobileLayout.matches ? 1 : 2);

    L.control.zoom({ position: 'topright' }).addTo(map);
    map.createPane('basemap');
    map.getPane('basemap').style.zIndex = '200';
    map.createPane('labels');
    map.getPane('labels').style.zIndex = '250';
    map.getPane('labels').style.pointerEvents = 'none';

    L.geoJSON(worldCountries, {
      pane: 'basemap',
      interactive: false,
      style: (country) => ({
        color: '#587383',
        weight: 0.62,
        opacity: 0.9,
        fillColor: colorFor(country.id ?? country.properties?.name, countryPalette),
        fillOpacity: 0.96,
      }),
    }).addTo(map);
    addRegionLabels();

    clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: mobileLayout.matches ? 38 : 46,
      removeOutsideVisibleBounds: false,
      iconCreateFunction: createClusterIcon,
    }).addTo(map);

    clusterGroup.on('animationend spiderfied unspiderfied', () => requestAnimationFrame(configureClusterElements));
    map.on('zoomend moveend', () => {
      updateCoordinateReadout();
      requestAnimationFrame(configureClusterElements);
    });

    for (const startup of startups) {
      const marker = L.marker(startup.coordinates, {
        icon: createMarkerIcon(startup),
        keyboard: true,
        riseOnHover: true,
        title: `${startup.name} — ${startup.city}, ${startup.country}`,
      });
      marker.bindTooltip(makeTooltip(startup), { direction: 'top', offset: [0, -18], className: 'startup-tooltip' });
      marker.on('click', () => openProfile(startup.slug, { updateUrl: true, focusMap: false, invoker: marker.getElement() }));
      marker.on('add', () => configureMarkerElement(marker, startup));
      markers.set(startup.slug, marker);
    }

    setTimeout(() => {
      map.invalidateSize();
      updateCoordinateReadout();
      configureClusterElements();
    }, 0);
  } catch (error) {
    console.error('Map initialization failed:', error);
    showMapFailure();
  }
}

function showMapFailure() {
  elements.mapStatus.hidden = false;
}

function mapFitPadding() {
  if (mobileLayout.matches) {
    return { paddingTopLeft: [24, 55], paddingBottomRight: [24, Math.min(window.innerHeight * 0.48, 410)] };
  }
  if (window.innerWidth <= 1100) {
    return { paddingTopLeft: [338, 64], paddingBottomRight: [34, 50] };
  }
  return { paddingTopLeft: [378, 64], paddingBottomRight: [338, 54] };
}

function positionSingleMarker() {
  if (!map || !mobileLayout.matches) return;
  map.panBy([0, Math.min(window.innerHeight * 0.2, 160)], { animate: !prefersReducedMotion });
}

function updateMapMarkers(visible, fitMap = false) {
  if (!map || !clusterGroup) return;
  clusterGroup.clearLayers();
  visible.forEach((startup) => {
    const marker = markers.get(startup.slug);
    marker.setIcon(createMarkerIcon(startup, state.selectedSlug === startup.slug));
    clusterGroup.addLayer(marker);
  });
  requestAnimationFrame(configureClusterElements);

  if (!fitMap || visible.length === 0) return;
  const bounds = L.latLngBounds(visible.map((startup) => startup.coordinates));
  if (visible.length === 1) {
    map.setView(visible[0].coordinates, 5, { animate: !prefersReducedMotion });
    positionSingleMarker();
  } else {
    map.fitBounds(bounds, { ...mapFitPadding(), maxZoom: 5, animate: !prefersReducedMotion });
  }
}

function focusStartupOnMap(startup) {
  if (!map || !clusterGroup) return;
  const marker = markers.get(startup.slug);
  if (!clusterGroup.hasLayer(marker)) return;
  clusterGroup.zoomToShowLayer(marker, () => {
    map.setView(startup.coordinates, Math.max(map.getZoom(), 5), { animate: !prefersReducedMotion });
    positionSingleMarker();
  });
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${dateString}T00:00:00Z`),
  );
}

function profileUrl(startup) {
  return buildStartupUrl(window.location.href, startup.slug).toString();
}

function updateSelectedPresentation() {
  document.querySelectorAll('.startup-card').forEach((card) => {
    card.setAttribute('aria-current', String(card.dataset.slug === state.selectedSlug));
  });
  markers.forEach((marker, slug) => {
    const startup = startupBySlug.get(slug);
    marker.setIcon(createMarkerIcon(startup, slug === state.selectedSlug));
  });
}

function fillProfile(startup) {
  const identityColor = colorFor(startup.sector);
  elements.profileMonogram.textContent = initialsFor(startup.name);
  elements.profileMonogram.style.setProperty('--identity-color', identityColor);
  elements.profileSector.textContent = startup.sector;
  elements.profileSector.style.setProperty('--identity-color', identityColor);
  elements.profileName.textContent = startup.name;
  elements.profileLocation.textContent = `${startup.city}, ${startup.country} · ${startup.region}`;
  elements.profileDescription.textContent = startup.description;
  elements.profileWebsite.href = startup.website;
  elements.profileWebsite.setAttribute('aria-label', `Visit ${startup.name} website (opens in a new tab)`);
  elements.profileVerified.textContent = formatDate(startup.lastVerified);
  elements.correctionLink.href = buildCorrectionIssueUrl(startup);
  elements.shareStatus.textContent = '';
  elements.shareFallback.hidden = true;
  elements.shareUrl.value = profileUrl(startup);

  const sources = document.createDocumentFragment();
  startup.sources.forEach((source, index) => {
    const item = document.createElement('li');
    const link = createElement('a', '', `Source ${index + 1} — ${new URL(source).hostname.replace(/^www\./, '')} ↗`);
    link.href = source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Open public source ${index + 1} for ${startup.name} in a new tab`);
    item.append(link);
    sources.append(item);
  });
  elements.profileSources.replaceChildren(sources);
}

function showProfileDialog() {
  if (mobileLayout.matches) {
    elements.profileDialog.showModal();
  } else {
    elements.profileDialog.show();
  }
}

function openProfile(slug, { updateUrl = false, focusMap = false, invoker = null } = {}) {
  const startup = startupBySlug.get(slug);
  if (!startup) return false;

  const wasOpen = elements.profileDialog.open;
  state.selectedSlug = slug;
  fillProfile(startup);
  updateSelectedPresentation();
  document.title = `${startup.name} — StartupMap`;

  if (focusMap) focusStartupOnMap(startup);

  if (updateUrl) {
    const nextUrl = buildStartupUrl(window.location.href, startup.slug);
    if (wasOpen) {
      history.replaceState({ startup: startup.slug }, '', nextUrl);
    } else {
      history.pushState({ startup: startup.slug }, '', nextUrl);
      state.profileEntryPushed = true;
    }
  }

  if (!wasOpen) {
    if (invoker instanceof HTMLElement) dialogInvokers.set(elements.profileDialog, invoker);
    showProfileDialog();
    requestAnimationFrame(() => elements.profileDialog.querySelector('[data-close-profile]').focus());
  }
  return true;
}

function clearProfile() {
  state.selectedSlug = '';
  updateSelectedPresentation();
  document.title = 'StartupMap — Discover startups by place';
  if (elements.profileDialog.open) elements.profileDialog.close();
}

function closeProfile({ updateUrl = true } = {}) {
  const shouldGoBack = updateUrl && state.profileEntryPushed;
  clearProfile();
  state.profileEntryPushed = false;

  if (shouldGoBack) {
    history.back();
  } else if (updateUrl) {
    history.replaceState({}, '', buildStartupUrl(window.location.href));
  }
}

function restoreDialogFocus(dialog) {
  const invoker = dialogInvokers.get(dialog);
  dialogInvokers.delete(dialog);
  if (invoker?.isConnected) requestAnimationFrame(() => invoker.focus({ preventScroll: true }));
}

function openMethodologyDialog(invoker) {
  if (elements.methodologyDialog.open) return;
  dialogInvokers.set(elements.methodologyDialog, invoker);
  elements.methodologyDialog.showModal();
  requestAnimationFrame(() => elements.methodologyDialog.querySelector('[data-close-methodology]').focus());
}

function closeMethodologyDialog() {
  if (elements.methodologyDialog.open) elements.methodologyDialog.close();
}

function openSubmitDialog(invoker) {
  if (elements.submitDialog.open) return;
  dialogInvokers.set(elements.submitDialog, invoker);
  elements.submitStatus.textContent = '';
  elements.submitFallback.href = 'https://github.com/ternome/startupmap/issues/new/choose';
  elements.submitDialog.showModal();
  requestAnimationFrame(() => elements.submitForm.elements.name.focus());
}

function closeSubmitDialog() {
  if (elements.submitDialog.open) elements.submitDialog.close();
}

function showShareFallback(message) {
  elements.shareFallback.hidden = false;
  elements.shareUrl.value = profileUrl(startupBySlug.get(state.selectedSlug));
  elements.shareUrl.focus();
  elements.shareUrl.select();
  elements.shareStatus.textContent = message;
}

async function copyProfileLink() {
  const startup = startupBySlug.get(state.selectedSlug);
  if (!startup) return;
  const url = profileUrl(startup);

  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(url);
    elements.shareStatus.textContent = 'Profile link copied.';
    elements.shareFallback.hidden = true;
  } catch {
    elements.shareUrl.value = url;
    elements.shareFallback.hidden = false;
    elements.shareUrl.select();
    try {
      if (!document.execCommand('copy')) throw new Error('Legacy copy failed');
      elements.shareStatus.textContent = 'Profile link copied.';
    } catch {
      showShareFallback('Automatic copy is unavailable. The full link is selected for you.');
    }
  }
}

async function shareProfile() {
  const startup = startupBySlug.get(state.selectedSlug);
  if (!startup || !navigator.share) return;
  try {
    await navigator.share({
      title: `${startup.name} — StartupMap`,
      text: `Explore ${startup.name} in ${startup.city}, ${startup.country} on StartupMap.`,
      url: profileUrl(startup),
    });
    elements.shareStatus.textContent = 'Share sheet opened.';
  } catch (error) {
    if (error.name !== 'AbortError') showShareFallback('Sharing is unavailable. The full link is selected for you.');
  }
}

function isHttpsField(field) {
  try {
    return new URL(field.value).protocol === 'https:';
  } catch {
    return false;
  }
}

function handleSubmission(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const website = form.elements.website;
  const source = form.elements.source;
  website.setCustomValidity(isHttpsField(website) ? '' : 'Use a complete HTTPS website URL.');
  source.setCustomValidity(isHttpsField(source) ? '' : 'Use a complete HTTPS source URL.');
  if (!form.reportValidity()) return;

  const issueUrl = buildSubmissionIssueUrl(Object.fromEntries(new FormData(form)));
  elements.submitFallback.href = issueUrl;
  const issueWindow = window.open(issueUrl, '_blank');
  if (issueWindow) issueWindow.opener = null;
  elements.submitStatus.textContent = issueWindow
    ? 'GitHub opened in a new tab. Nothing is submitted until you finish the issue there.'
    : 'The new tab was blocked. Use the direct issue link below; nothing has been submitted yet.';
  elements.submitFallback.textContent = 'Open the prefilled issue directly ↗';
}

function handlePopState() {
  state.profileEntryPushed = false;
  const slug = getStartupSlugFromUrl(window.location.href);
  if (slug && openProfile(slug, { updateUrl: false })) return;
  clearProfile();
}

function initialize() {
  const canonical = new URL('/', window.location.href);
  elements.canonicalLink.href = canonical.toString();
  elements.startupTotal.textContent = String(startups.length);
  elements.countryTotal.textContent = String(new Set(startups.map((startup) => startup.country)).size);
  elements.regionTotal.textContent = String(new Set(startups.map((startup) => startup.region)).size);
  populateSelect(elements.sectorFilter, uniqueSorted(startups, 'sector'));
  populateSelect(elements.regionFilter, uniqueSorted(startups, 'region'));
  elements.shareProfile.hidden = !navigator.share;

  initializeMap();
  renderDiscovery({ fitMap: true });

  elements.search.addEventListener('input', (event) => {
    state.query = event.currentTarget.value;
    renderDiscovery({ fitMap: true });
  });
  elements.sectorFilter.addEventListener('change', (event) => {
    state.sector = event.currentTarget.value;
    renderDiscovery({ fitMap: true });
  });
  elements.regionFilter.addEventListener('change', (event) => {
    state.region = event.currentTarget.value;
    renderDiscovery({ fitMap: true });
  });
  elements.resetFilters.addEventListener('click', resetFilters);
  elements.emptyReset.addEventListener('click', resetFilters);
  elements.mobileResultsToggle.addEventListener('click', () => {
    setResultsExpanded(!state.resultsExpanded, { moveFocus: true });
  });
  elements.retryMap.addEventListener('click', () => window.location.reload());
  elements.copyLink.addEventListener('click', copyProfileLink);
  elements.shareProfile.addEventListener('click', shareProfile);
  elements.submitForm.addEventListener('submit', handleSubmission);

  document.querySelectorAll('[data-open-methodology]').forEach((button) => {
    button.addEventListener('click', () => openMethodologyDialog(button));
  });
  document.querySelectorAll('[data-open-submit]').forEach((button) => {
    button.addEventListener('click', () => {
      if (elements.methodologyDialog.open) {
        dialogInvokers.delete(elements.methodologyDialog);
        elements.methodologyDialog.close();
        requestAnimationFrame(() => openSubmitDialog(button));
      } else {
        openSubmitDialog(button);
      }
    });
  });
  document.querySelector('[data-close-profile]').addEventListener('click', () => closeProfile());
  document.querySelector('[data-close-methodology]').addEventListener('click', closeMethodologyDialog);
  document.querySelector('[data-close-submit]').addEventListener('click', closeSubmitDialog);

  elements.profileDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeProfile();
  });
  elements.methodologyDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMethodologyDialog();
  });
  elements.submitDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSubmitDialog();
  });
  elements.profileDialog.addEventListener('close', () => restoreDialogFocus(elements.profileDialog));
  elements.methodologyDialog.addEventListener('close', () => restoreDialogFocus(elements.methodologyDialog));
  elements.submitDialog.addEventListener('close', () => restoreDialogFocus(elements.submitDialog));
  elements.profileDialog.addEventListener('click', (event) => {
    if (event.target === elements.profileDialog && elements.profileDialog.matches(':modal')) closeProfile();
  });
  elements.methodologyDialog.addEventListener('click', (event) => {
    if (event.target === elements.methodologyDialog) closeMethodologyDialog();
  });
  elements.submitDialog.addEventListener('click', (event) => {
    if (event.target === elements.submitDialog) closeSubmitDialog();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.profileDialog.open && !elements.profileDialog.matches(':modal')) {
      event.preventDefault();
      closeProfile();
      return;
    }
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const editable = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (!editable && !elements.submitDialog.open && !elements.methodologyDialog.open) {
        event.preventDefault();
        setResultsExpanded(true);
        elements.search.focus();
      }
    }
  });
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('resize', () => {
    if (!map) return;
    map.setMinZoom(mobileLayout.matches ? 1 : 2);
    requestAnimationFrame(() => map.invalidateSize({ pan: false }));
  });

  const initialSlug = getStartupSlugFromUrl(window.location.href);
  if (initialSlug && !openProfile(initialSlug, { updateUrl: false })) {
    history.replaceState({}, '', buildStartupUrl(window.location.href));
  }
}

initialize();
