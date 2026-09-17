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

const elements = {
  canonicalLink: document.querySelector('#canonical-link'),
  startupTotal: document.querySelector('#startup-total'),
  regionTotal: document.querySelector('#region-total'),
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

function resetFilters() {
  state.query = '';
  state.sector = 'All sectors';
  state.region = 'All regions';
  elements.search.value = '';
  elements.sectorFilter.value = state.sector;
  elements.regionFilter.value = state.region;
  renderDiscovery({ fitMap: true });
  elements.search.focus();
}

function createStartupCard(startup) {
  const item = document.createElement('li');
  const button = createElement('button', 'startup-card');
  button.type = 'button';
  button.dataset.slug = startup.slug;
  button.setAttribute('aria-label', `Open ${startup.name}, ${startup.city}, ${startup.country}`);
  button.setAttribute('aria-current', String(state.selectedSlug === startup.slug));

  const copy = document.createElement('span');
  const heading = createElement('h3', '', startup.name);
  const meta = document.createElement('p');
  meta.append(document.createTextNode(`${startup.city}, ${startup.country} · `));
  meta.append(createElement('span', 'card-sector', startup.sector));
  copy.append(heading, meta);

  button.append(copy, createElement('span', 'card-arrow', '↗'));
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
  elements.resetFilters.disabled = !hasActiveFilters();
  elements.emptyState.hidden = visible.length > 0;
  elements.startupList.hidden = visible.length === 0;
  updateMapMarkers(visible, fitMap);
}

function createMarkerIcon(selected = false) {
  return L.divIcon({
    className: 'startup-marker-wrap',
    html: `<span class="startup-marker${selected ? ' is-selected' : ''}" aria-hidden="true"></span>`,
    iconSize: [17, 17],
    iconAnchor: [8, 8],
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

function initializeMap() {
  try {
    map = L.map('map', {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 20,
      maxBounds: [[-85, -210], [85, 210]],
      maxBoundsViscosity: 0.6,
    }).setView([18, 8], 2);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.createPane('basemap');
    map.getPane('basemap').style.zIndex = '200';
    L.geoJSON(feature(worldTopology, worldTopology.objects.countries), {
      pane: 'basemap',
      interactive: false,
      style: {
        color: '#3b453b',
        weight: 0.7,
        fillColor: '#1c241d',
        fillOpacity: 1,
      },
    }).addTo(map);
    clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 45,
      removeOutsideVisibleBounds: false,
    }).addTo(map);

    for (const startup of startups) {
      const marker = L.marker(startup.coordinates, {
        icon: createMarkerIcon(false),
        keyboard: true,
        riseOnHover: true,
        title: `${startup.name} — ${startup.city}, ${startup.country}`,
      });
      marker.bindTooltip(makeTooltip(startup), { direction: 'top', offset: [0, -9], className: 'startup-tooltip' });
      marker.on('click', () => openProfile(startup.slug, { updateUrl: true, focusMap: false, invoker: marker.getElement() }));
      marker.on('add', () => configureMarkerElement(marker, startup));
      markers.set(startup.slug, marker);
    }

    setTimeout(() => map.invalidateSize(), 0);
  } catch (error) {
    console.error('Map initialization failed:', error);
    showMapFailure();
  }
}

function showMapFailure() {
  elements.mapStatus.hidden = false;
}

function updateMapMarkers(visible, fitMap = false) {
  if (!map || !clusterGroup) return;
  clusterGroup.clearLayers();
  visible.forEach((startup) => {
    const marker = markers.get(startup.slug);
    marker.setIcon(createMarkerIcon(state.selectedSlug === startup.slug));
    clusterGroup.addLayer(marker);
  });

  if (!fitMap || visible.length === 0) return;
  const bounds = L.latLngBounds(visible.map((startup) => startup.coordinates));
  if (visible.length === 1) {
    map.setView(visible[0].coordinates, 5, { animate: !prefersReducedMotion });
  } else {
    map.fitBounds(bounds, { padding: [45, 45], maxZoom: 5, animate: !prefersReducedMotion });
  }
}

function focusStartupOnMap(startup) {
  if (!map || !clusterGroup) return;
  const marker = markers.get(startup.slug);
  if (!clusterGroup.hasLayer(marker)) return;
  clusterGroup.zoomToShowLayer(marker, () => {
    map.setView(startup.coordinates, Math.max(map.getZoom(), 5), { animate: !prefersReducedMotion });
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
  markers.forEach((marker, slug) => marker.setIcon(createMarkerIcon(slug === state.selectedSlug)));
}

function fillProfile(startup) {
  elements.profileName.textContent = startup.name;
  elements.profileSector.textContent = startup.sector;
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
    elements.profileDialog.showModal();
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
  elements.retryMap.addEventListener('click', () => window.location.reload());
  elements.copyLink.addEventListener('click', copyProfileLink);
  elements.shareProfile.addEventListener('click', shareProfile);
  elements.submitForm.addEventListener('submit', handleSubmission);

  document.querySelectorAll('[data-open-submit]').forEach((button) => {
    button.addEventListener('click', () => openSubmitDialog(button));
  });
  document.querySelector('[data-close-profile]').addEventListener('click', () => closeProfile());
  document.querySelector('[data-close-submit]').addEventListener('click', closeSubmitDialog);

  elements.profileDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeProfile();
  });
  elements.submitDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSubmitDialog();
  });
  elements.profileDialog.addEventListener('close', () => restoreDialogFocus(elements.profileDialog));
  elements.submitDialog.addEventListener('close', () => restoreDialogFocus(elements.submitDialog));
  elements.profileDialog.addEventListener('click', (event) => {
    if (event.target === elements.profileDialog) closeProfile();
  });
  elements.submitDialog.addEventListener('click', (event) => {
    if (event.target === elements.submitDialog) closeSubmitDialog();
  });
  window.addEventListener('popstate', handlePopState);

  const initialSlug = getStartupSlugFromUrl(window.location.href);
  if (initialSlug && !openProfile(initialSlug, { updateUrl: false })) {
    history.replaceState({}, '', buildStartupUrl(window.location.href));
  }
}

initialize();
