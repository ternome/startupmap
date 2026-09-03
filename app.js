const startups = [
  { name: 'Northstar AI', city: 'Helsinki, Finland', sector: 'AI', stage: 'Seed', lat: 60.1699, lng: 24.9384, description: 'Making industrial intelligence accessible to every team.' },
  { name: 'Moss Energy', city: 'Berlin, Germany', sector: 'Climate', stage: 'Series A', lat: 52.52, lng: 13.405, description: 'Software for a faster, cleaner energy transition.' },
  { name: 'Routable', city: 'London, UK', sector: 'Fintech', stage: 'Seed', lat: 51.5072, lng: -0.1276, description: 'The financial infrastructure for modern logistics.' },
  { name: 'Kite Health', city: 'Toronto, Canada', sector: 'Health', stage: 'Series A', lat: 43.6532, lng: -79.3832, description: 'A calmer, more personal way to manage your health.' },
  { name: 'Lumen', city: 'São Paulo, Brazil', sector: 'Consumer', stage: 'Pre-seed', lat: -23.5505, lng: -46.6333, description: 'Everyday tools for a more intentional life.' },
  { name: 'Maji Labs', city: 'Nairobi, Kenya', sector: 'Climate', stage: 'Seed', lat: -1.2864, lng: 36.8172, description: 'Building resilient water systems for growing cities.' },
  { name: 'Orbit Robotics', city: 'Singapore', sector: 'AI', stage: 'Series B', lat: 1.3521, lng: 103.8198, description: 'Autonomous systems for the places we live and work.' },
  { name: 'Nami', city: 'Tokyo, Japan', sector: 'Consumer', stage: 'Seed', lat: 35.6762, lng: 139.6503, description: 'A new social layer for city life.' }
];

const map = L.map('map', { zoomControl: false, worldCopyJump: true }).setView([25, 10], 2);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
const markers = new Map();
const markerIcon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

startups.forEach(startup => {
  const marker = L.marker([startup.lat, startup.lng], { icon: markerIcon }).bindPopup(`<div class="popup-title">${startup.name}</div><div class="popup-meta">${startup.city} · ${startup.sector} · ${startup.stage}</div><p>${startup.description}</p>`).addTo(map);
  markers.set(startup.name, marker);
});

const sectors = ['All', ...new Set(startups.map(item => item.sector))];
let activeSector = 'All';
const filters = document.querySelector('#filters');
sectors.forEach(sector => { const button = document.createElement('button'); button.className = `filter ${sector === 'All' ? 'active' : ''}`; button.textContent = sector; button.onclick = () => { activeSector = sector; document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item.textContent === sector)); render(); }; filters.appendChild(button); });

function render() {
  const query = document.querySelector('#search').value.toLowerCase().trim();
  const visible = startups.filter(item => (activeSector === 'All' || item.sector === activeSector) && `${item.name} ${item.city} ${item.sector}`.toLowerCase().includes(query));
  document.querySelector('#result-count').textContent = visible.length;
  document.querySelector('#startup-count').textContent = startups.length;
  document.querySelector('#startup-list').innerHTML = visible.map(item => `<button class="startup-card" data-name="${item.name}"><h3>${item.name}</h3><p>${item.city}<span class="tag">${item.sector}</span></p></button>`).join('') || '<p style="color:var(--muted);font:12px DM Mono;padding-top:18px">No startups found.</p>';
  document.querySelectorAll('.startup-card').forEach(card => card.onclick = () => { const startup = startups.find(item => item.name === card.dataset.name); map.flyTo([startup.lat, startup.lng], 5); markers.get(startup.name).openPopup(); });
}
document.querySelector('#search').addEventListener('input', render);
document.querySelector('#submit-button').onclick = () => alert('Startup submissions are coming soon.');
render();
