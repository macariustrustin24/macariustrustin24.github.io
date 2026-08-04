const youtubeForm = document.getElementById('youtube-form');
const youtubeUrl = document.getElementById('youtube-url');
const youtubeFrame = document.getElementById('youtube-frame');

const YOUTUBE_REGEX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/;

function extractVideoId(value) {
  const trimmed = value.trim();
  const match = trimmed.match(YOUTUBE_REGEX);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

function createProxyUrl(videoId) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&controls=1&modestbranding=1`;
  return `/proxy?url=${encodeURIComponent(embedUrl)}`;
}

function renderIframe(videoId) {
  if (!videoId) {
    youtubeFrame.innerHTML = '<p class="error-text">Enter a valid YouTube link or ID.</p>';
    return;
  }
  youtubeFrame.innerHTML = `<iframe src="${createProxyUrl(videoId)}" title="YouTube player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
}

youtubeForm.addEventListener('submit', event => {
  event.preventDefault();
  const videoId = extractVideoId(youtubeUrl.value);
  renderIframe(videoId);
});
