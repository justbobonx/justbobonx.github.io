const isMobile = () => window.matchMedia('(max-width: 640px)').matches;

function bindCards() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.go-link')) return;

      if (isMobile()) {
        e.preventDefault();
        const wasOpen = card.classList.contains('open');
        document.querySelectorAll('.card.open').forEach(c => c.classList.remove('open'));
        if (!wasOpen) card.classList.add('open');
      } else {
        const href = card.dataset.href;
        if (href) window.open(href, '_blank', 'noopener,noreferrer');
      }
    });
  });
}

async function loadItems() {
  const res = await fetch('items.json');
  const items = await res.json();
  const cascade = document.getElementById('work');

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = `card card-${item.type}`;
    card.dataset.href = item.url;

    card.innerHTML = `
      <div class="card-face">
        <img class="card-shot" src="${item.image}" alt="${item.name} screenshot">
        <h2 class="card-title">${item.name}</h2>
        <div class="card-blurb">
          <p>${item.text}</p>
          <a class="go-link" href="${item.url}" target="_blank" rel="noopener noreferrer">OPEN →</a>
        </div>
      </div>
    `;

    cascade.appendChild(card);
  });

  bindCards();
}

window.addEventListener('resize', () => {
  if (!isMobile()) document.querySelectorAll('.card.open').forEach(c => c.classList.remove('open'));
});

loadItems();
