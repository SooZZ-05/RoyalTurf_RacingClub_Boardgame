(() => {
  // Transcribed from the photographed Traditional Chinese board, rather than
  // the English transcription, which differs in third place / three units.
  // Source: docs/observed-components.json → board.payout.
  const payouts = [
    [500, 350, 250, 200, 150],
    [350, 250, 200, 150, 100],
    [250, 200, 150, 100, 100],
  ];
  const places = ['冠軍', '亞軍', '季軍'];
  const units = ['1', '2', '3', '4', '5+'];
  const board = document.querySelector('#board-scene');
  if (!board) return;

  const table = (detail = false) => `
    <table class="payout-table${detail ? ' payout-table-detail' : ''}">
      <caption class="payout-visually-hidden">同一匹馬的總下注票數與每票獎金對照表</caption>
      <thead><tr><th scope="col">${detail ? '名次／總票數' : '總票數'}</th>${units.map(unit => `<th scope="col">${unit}</th>`).join('')}</tr></thead>
      <tbody>${payouts.map((row, place) => `<tr><th scope="row">${places[place]}</th>${row.map(amount => `<td>${amount}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;

  const plate = document.createElement('section');
  plate.className = 'payout-plate';
  plate.setAttribute('aria-label', '棋盤內的每票獎金表');
  plate.innerHTML = `
    <div class="payout-plate-title"><span>每票獎金</span><span aria-hidden="true">↗</span></div>
    ${table()}
    <button type="button" class="payout-expand" aria-label="放大每票獎金表與分獎說明" aria-haspopup="dialog" aria-controls="payout-dialog"></button>`;
  board.append(plate);

  const dialog = document.createElement('dialog');
  dialog.id = 'payout-dialog';
  dialog.className = 'payout-dialog';
  dialog.setAttribute('aria-labelledby', 'payout-title');
  dialog.innerHTML = `
    <button type="button" class="dialog-close" aria-label="關閉獎金表">×</button>
    <span class="eyebrow">PRIZE SCHEDULE</span>
    <h2 id="payout-title">每票獎金</h2>
    <p class="payout-intro">依賽馬的完賽名次，以及押在該馬上的總票數，查出每票可得的獎金。</p>
    ${table(true)}
    <div class="payout-formula"><span>你的獎金</span><strong>每票獎金 <i>×</i> 你的籌碼數值</strong></div>
    <p class="payout-example">例如：冠軍馬合共押了 <b>2 票</b>，每票可得 <b>$350</b>。你的籌碼是 <b>2</b>，就可得 <b>$700</b>。</p>
    <ul class="payout-notes">
      <li>總票數是同一匹馬上所有籌碼的數值總和，不是玩家人數。</li>
      <li>0 號籌碼不增加票數，也不獲得獎金；5 票或以上使用「5+」欄。</li>
      <li>第 3 場獎金加倍；上表列出第 1、2 場的每票金額。</li>
    </ul>
    <a class="payout-source" href="https://punchboardgame.pixnet.net/blog/posts/9573680628" target="_blank" rel="noreferrer">繁中棋盤與規則參考 ↗</a>`;
  document.body.append(dialog);

  plate.querySelector('.payout-expand').addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
})();
