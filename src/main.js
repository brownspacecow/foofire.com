import { calculateDistance } from './utils/distance.js';

const form = document.querySelector('#zip-form');
const zipInput = document.querySelector('#zip-input');
const statusEl = document.querySelector('#status');
const resultsEl = document.querySelector('#results');
const geoButton = document.querySelector('#geo-button');

let shows = [];

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const setStatus = (message) => {
  statusEl.textContent = message;
};

const milesLabel = (miles) =>
  Number.isFinite(miles) ? `${Math.round(miles).toLocaleString()} miles away` : 'Search to see distance';

const countdownLabel = (showDate) => {
  const today = new Date();
  const target = new Date(`${showDate}T00:00:00`);
  const days = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (Number.isNaN(days)) {
    return '';
  }
  if (days <= 0) {
    return 'Happening now';
  }
  return `${days} days away`;
};

const renderShows = (rankedShows) => {
  if (!rankedShows.length) {
    resultsEl.replaceChildren();
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'No upcoming shows found.';
    resultsEl.append(emptyMessage);
    return;
  }

  const cards = rankedShows.map((show, index) => {
    const card = document.createElement('article');
    card.className = 'show-card';

    if (index === 0) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Closest To You';
      card.append(badge);
    }

    const title = document.createElement('h3');
    title.textContent = `${show.city}, ${show.state}`;
    card.append(title);

    const venue = document.createElement('p');
    venue.textContent = show.venue;
    card.append(venue);

    const date = document.createElement('p');
    date.textContent = dateFormatter.format(new Date(`${show.date}T00:00:00`));
    card.append(date);

    const distance = document.createElement('p');
    distance.className = 'distance';
    distance.textContent = milesLabel(show.distance);
    card.append(distance);

    const countdown = document.createElement('p');
    countdown.textContent = countdownLabel(show.date);
    card.append(countdown);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const ticketLink = document.createElement('a');
    ticketLink.href = show.ticketUrl;
    ticketLink.target = '_blank';
    ticketLink.rel = 'noreferrer noopener';
    ticketLink.textContent = 'Buy Tickets';
    actions.append(ticketLink);

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.setAttribute('data-ticket-url', show.ticketUrl);
    copyButton.textContent = 'Copy Ticket Link';
    actions.append(copyButton);

    card.append(actions);
    return card;
  });

  resultsEl.replaceChildren(...cards);
};

const normalizeShows = (entries) =>
  entries
    .filter((show) => Number.isFinite(show.latitude) && Number.isFinite(show.longitude))
    .map((show) => ({ ...show }));

const findAndRender = (latitude, longitude) => {
  const rankedShows = shows
    .map((show) => ({
      ...show,
      distance: calculateDistance(latitude, longitude, show.latitude, show.longitude),
    }))
    .sort((a, b) => a.distance - b.distance);

  renderShows(rankedShows);
  setStatus(`Showing ${rankedShows.length} upcoming shows ordered by distance.`);
};

const fetchShows = async () => {
  const response = await fetch('./public/data/shows.json');
  if (!response.ok) {
    throw new Error('Could not load show data.');
  }
  return normalizeShows(await response.json());
};

const fetchZipCoordinates = async (zipCode) => {
  const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
  if (!response.ok) {
    throw new Error('Please enter a valid U.S. ZIP code.');
  }

  const payload = await response.json();
  const place = payload.places?.[0];
  const latitude = Number.parseFloat(place?.latitude ?? NaN);
  const longitude = Number.parseFloat(place?.longitude ?? NaN);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Could not determine location for that ZIP code.');
  }

  return { latitude, longitude };
};

const onZipSubmit = async (event) => {
  event.preventDefault();

  const zipCode = zipInput.value.trim();
  if (!/^\d{5}$/.test(zipCode)) {
    setStatus('Please enter a valid 5-digit ZIP code.');
    return;
  }

  try {
    setStatus('Looking up your location and nearest shows...');
    const { latitude, longitude } = await fetchZipCoordinates(zipCode);
    findAndRender(latitude, longitude);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unable to search shows right now.');
  }
};

const onGeoSearch = () => {
  if (!navigator.geolocation) {
    setStatus('Geolocation is not available in this browser.');
    return;
  }

  setStatus('Getting your location...');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      findAndRender(position.coords.latitude, position.coords.longitude);
    },
    () => {
      setStatus('Could not access your location. Please search by ZIP code.');
    }
  );
};

const onCopyClick = async (event) => {
  const copyButton = event.target.closest('button[data-ticket-url]');
  if (!copyButton) {
    return;
  }

  const ticketUrl = copyButton.getAttribute('data-ticket-url');
  if (!ticketUrl) {
    return;
  }

  try {
    await navigator.clipboard.writeText(ticketUrl);
    setStatus('Ticket link copied to clipboard.');
  } catch {
    setStatus('Could not copy link.');
  }
};

const init = async () => {
  try {
    setStatus('Loading upcoming shows...');
    shows = await fetchShows();
    renderShows(shows);
    setStatus('Enter a ZIP code to find your nearest show.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not load shows.');
  }
};

form.addEventListener('submit', onZipSubmit);
geoButton.addEventListener('click', onGeoSearch);
resultsEl.addEventListener('click', onCopyClick);

init();
