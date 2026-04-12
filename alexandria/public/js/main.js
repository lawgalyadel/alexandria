// Theme toggle
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('alexandria-theme');
if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
} else if (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        if (next === 'light') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        localStorage.setItem('alexandria-theme', next);
    });
}

// Mobile hamburger
const hamburger = document.getElementById('hamburger');
const navBar = document.getElementById('navBar');
if (hamburger && navBar) {
    hamburger.addEventListener('click', () => navBar.classList.toggle('open'));
}

// Scroll reveal
const reveals = document.querySelectorAll('.reveal');
function revealOnScroll() {
    reveals.forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight - 60) {
            el.classList.add('active');
        }
    });
}
window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);

// Reading progress bar
const progressBar  = document.getElementById('readingProgressBar');
const progressPct  = document.getElementById('readingProgressPct');
const progressWrap = document.getElementById('readingProgressWrap');
const articleBody  = document.querySelector('.article-body');

if (progressBar && articleBody) {
    window.addEventListener('scroll', () => {
        const articleTop    = articleBody.offsetTop;
        const articleHeight = articleBody.offsetHeight;
        const scrolled      = window.scrollY - articleTop;
        const pct           = Math.min(100, Math.max(0, (scrolled / articleHeight) * 100));

        progressBar.style.width = pct + '%';
        if (progressPct) progressPct.textContent = Math.round(pct) + '%';

        // Show after scrolling past header
        if (progressWrap) {
            progressWrap.classList.toggle('visible', window.scrollY > 60);
        }
    });
}