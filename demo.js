let clicks = 0;
document.getElementById('hint').addEventListener('click', () => {
  const hint = document.getElementById('hint-text'); hint.hidden = !hint.hidden;
});
for (const button of document.querySelectorAll('.answer')) button.addEventListener('click', () => {
  clicks++;
  document.getElementById('feedback').textContent = button.dataset.answer === 'mean' ? 'Correct! The mean gives you the average price.' : 'Try again. You are looking for the average.';
  document.getElementById('click-count').textContent = `Answer clicks: ${clicks}`;
});
document.getElementById('next').addEventListener('click', () => { document.getElementById('next-text').hidden = false; });
