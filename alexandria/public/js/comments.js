// public/js/comments.js
// Handles comment submission and upvoting via fetch API

(function () {
  'use strict';

  // ── Submit comment ──────────────────────────────────────────────────────────
  const form      = document.getElementById('comment-form');
  const feedback  = document.getElementById('comment-feedback');
  const submitBtn = document.getElementById('comment-submit');
  const list      = document.getElementById('comments-list');
  const empty     = document.getElementById('comments-empty');

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const articleId   = form.dataset.articleId;
      const displayName = form.querySelector('#comment-name').value.trim();
      const body        = form.querySelector('#comment-body').value.trim();

      if (!displayName || !body) return;

      // Loading state
      submitBtn.disabled    = true;
      submitBtn.textContent = 'Posting…';
      feedback.hidden       = true;
      feedback.className    = 'comment-form__feedback';

      try {
        const res  = await fetch(`/comments/${articleId}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ display_name: displayName, body })
        });
        const data = await res.json();

        if (!data.ok) {
          showFeedback('error', data.error || 'Something went wrong. Please try again.');
          return;
        }

        if (data.status === 'approved') {
          // Append the comment immediately
          if (empty) empty.remove();
          const el = buildCommentEl(data.comment);
          el.classList.add('comment-item--new');
          list.prepend(el);

          // Update count in header
          const countEl = document.querySelector('.comments-count');
          if (countEl) {
            countEl.textContent = parseInt(countEl.textContent || '0', 10) + 1;
          } else {
            // Add the count badge
            const title = document.querySelector('.comments-title');
            if (title) {
              const badge = document.createElement('span');
              badge.className   = 'comments-count';
              badge.textContent = '1';
              title.appendChild(badge);
            }
          }

          form.querySelector('#comment-body').value = '';
          showFeedback('success', 'Your comment has been posted.');

          // Attach vote listener to new comment
          attachVoteListener(el.querySelector('.comment-vote-btn'));

        } else {
          // Rejected
          showFeedback('pending', data.message || 'Your comment was not approved.');
          form.querySelector('#comment-body').value = '';
        }

      } catch (err) {
        showFeedback('error', 'Network error. Please try again.');
      } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Post Comment';
      }
    });
  }

  // ── Upvoting ────────────────────────────────────────────────────────────────
  function attachVoteListener(btn) {
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (btn.classList.contains('voted') || btn.disabled) return;

      const commentId = btn.dataset.commentId;
      btn.disabled    = true;

      try {
        const res  = await fetch(`/comments/${commentId}/vote`, { method: 'POST' });
        const data = await res.json();

        if (data.ok) {
          btn.classList.add('voted');
          btn.querySelector('.comment-vote-btn__count').textContent = data.upvotes;
          // Re-sort comments by votes (simple DOM sort)
          sortComments();
        }
      } catch (err) {
        btn.disabled = false;
      }
    });
  }

  // Attach to all existing vote buttons on page load
  document.querySelectorAll('.comment-vote-btn').forEach(attachVoteListener);

  // ── Sort comments by upvotes in DOM ─────────────────────────────────────────
  function sortComments() {
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.comment-item'));
    items.sort((a, b) => {
      const aVotes = parseInt(a.querySelector('.comment-vote-btn__count')?.textContent || '0', 10);
      const bVotes = parseInt(b.querySelector('.comment-vote-btn__count')?.textContent || '0', 10);
      return bVotes - aVotes;
    });
    items.forEach(item => list.appendChild(item));
  }

  // ── Build comment DOM element from JSON ──────────────────────────────────────
  function buildCommentEl(comment) {
    const date = new Date(comment.created_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const div = document.createElement('div');
    div.className = 'comment-item';
    div.id        = `comment-${comment.id}`;
    div.innerHTML = `
      <div class="comment-item__meta">
        <span class="comment-item__name">${escHtml(comment.display_name)}</span>
        <span class="comment-item__date">${date}</span>
      </div>
      <div class="comment-item__body">${escHtml(comment.body)}</div>
      <div class="comment-item__actions">
        <button class="comment-vote-btn" data-comment-id="${comment.id}" aria-label="Upvote">
          <span class="comment-vote-btn__icon">↑</span>
          <span class="comment-vote-btn__count">0</span>
        </button>
      </div>
    `;
    return div;
  }

  // ── Feedback message ─────────────────────────────────────────────────────────
  function showFeedback(type, message) {
    feedback.hidden      = false;
    feedback.textContent = message;
    feedback.className   = `comment-form__feedback feedback--${type}`;
    setTimeout(() => { feedback.hidden = true; }, 6000);
  }

  // ── Escape HTML for dynamic insertion ───────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

})();
