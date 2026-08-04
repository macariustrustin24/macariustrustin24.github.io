const modal = document.querySelector('#game-modal');
const area = document.querySelector('#game-area');
let cleanup = () => {};
const PLAYBOX = window.PLAYBOX || {};
const USER_SCORES = PLAYBOX.userScores || {};
const CSRF_TOKEN = PLAYBOX.csrfToken || '';
const USER_LOGGED_IN = Boolean(PLAYBOX.userLoggedIn);

const best = (name, score) => {
  const key = `playbox-${name}`;
  const serverBest = USER_SCORES[name];
  if (score !== undefined) {
    localStorage.setItem(key, score);
    if (USER_LOGGED_IN) {
      fetch(`/api/scores/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf_token: CSRF_TOKEN, score }),
      }).then(response => response.ok ? response.json() : null).then(data => {
        if (data && data.best !== undefined) {
          USER_SCORES[name] = data.best;
        }
      }).catch(() => {});
    }
    return score;
  }
  const localBest = Number(localStorage.getItem(key) || 0);
  if (serverBest !== undefined && serverBest > localBest) {
    return serverBest;
  }
  return localBest;
};

document.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => openGame(button.dataset.game)));
document.querySelector('.close').addEventListener('click', closeGame);
modal.addEventListener('click', event => { if(event.target === modal) closeGame(); });
document.addEventListener('keydown', event => { if(event.key === 'Escape') closeGame(); });
function closeGame(){ cleanup(); cleanup=()=>{}; modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); area.innerHTML=''; }
function openGame(game){ closeGame(); modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); ({snake: snakeGame,tap:tapGame,memory:memoryGame,jump:jumpGame})[game](); }
function frame(title, detail, score){ area.innerHTML=`<div class="game-head"><div><h2>${title}</h2><p>${detail}</p></div><div class="score">${score}</div></div>`; }

function snakeGame(){
  let snake=[{x:9,y:9},{x:8,y:9},{x:7,y:9}], dir={x:1,y:0}, next=dir, food=spawn(), score=0, running=true;
  frame('Neon Snake','Use arrow keys or WASD to move.',`Score: 0 · Best: ${best('snake')}`); area.insertAdjacentHTML('beforeend','<div class="game-stage snake-stage"><div class="snake-grid"></div></div>'); const grid=area.querySelector('.snake-grid');
  function spawn(){let p; do p={x:Math.floor(Math.random()*18),y:Math.floor(Math.random()*18)}; while(snake.some(s=>s.x===p.x&&s.y===p.y)); return p;}
  function draw(){grid.innerHTML=''; snake.forEach(s=>{let e=document.createElement('i');e.className='snake';e.style.gridColumn=s.x+1;e.style.gridRow=s.y+1;grid.append(e)});let f=document.createElement('i');f.className='food';f.style.gridColumn=food.x+1;f.style.gridRow=food.y+1;grid.append(f)}
  function key(e){let d=({ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]})[e.key];if(d){e.preventDefault();if(d[0]!==-dir.x&&d[1]!==-dir.y)next={x:d[0],y:d[1]};}}
  function tick(){dir=next;let h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(h.x<0||h.x>17||h.y<0||h.y>17||snake.some(s=>s.x===h.x&&s.y===h.y)){running=false;best('snake',Math.max(score,+best('snake')));area.querySelector('.game-stage').innerHTML=`<div class="game-message"><h3>Game over!</h3><p>Score: ${score}</p><button class="again">Play again</button></div>`;area.querySelector('.again').onclick=snakeGame;return}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score++;food=spawn();area.querySelector('.score').textContent=`Score: ${score} · Best: ${Math.max(score,+best('snake'))}`}else snake.pop();draw();}
  draw();let timer=setInterval(tick,115);document.addEventListener('keydown',key);cleanup=()=>{clearInterval(timer);document.removeEventListener('keydown',key);};
}
function tapGame(){
  let score=0,time=20,timer;frame('Quick Tap','Click each target before it moves.',`Time: ${time} · Score: 0`);area.insertAdjacentHTML('beforeend','<div class="game-stage tap-stage"></div>');let stage=area.querySelector('.tap-stage');
  const target=()=>{if(time<=0)return;let t=document.createElement('button');t.className='target';t.style.left=`${5+Math.random()*78}%`;t.style.top=`${5+Math.random()*76}%`;t.onclick=()=>{score++;t.remove();target();area.querySelector('.score').textContent=`Time: ${time} · Score: ${score}`};stage.innerHTML='';stage.append(t)};target();timer=setInterval(()=>{time--;area.querySelector('.score').textContent=`Time: ${time} · Score: ${score}`;if(!time){clearInterval(timer);best('tap',Math.max(score,+best('tap')));stage.innerHTML=`<div class="game-message"><h3>Time!</h3><p>You hit ${score} targets. Best: ${best('tap')}</p><button class="again">Try again</button></div>`;stage.querySelector('.again').onclick=tapGame;}},1000);cleanup=()=>clearInterval(timer);
}
function memoryGame(){
  let icons=['🍕','🚀','🎲','🎸','🍕','🚀','🎲','🎸'].sort(()=>Math.random()-.5), open=[],moves=0,locked=false;frame('Flip Match','Find all four pairs.',`Moves: 0 · Best: ${best('memory')||'—'}`);area.insertAdjacentHTML('beforeend','<div class="memory-board"></div>');let board=area.querySelector('.memory-board');icons.forEach((icon,i)=>{let b=document.createElement('button');b.className='memory-card';b.dataset.icon=icon;b.textContent=icon;b.onclick=()=>flip(b);board.append(b)});
  function flip(card){if(locked||card.classList.contains('open')||card.classList.contains('done'))return;card.classList.add('open');open.push(card);if(open.length===2){moves++;area.querySelector('.score').textContent=`Moves: ${moves} · Best: ${best('memory')||'—'}`;if(open[0].dataset.icon===open[1].dataset.icon){open.forEach(x=>{x.classList.remove('open');x.classList.add('done')});open=[];if(board.querySelectorAll('.done').length===8){best('memory',!best('memory')||moves<best('memory')?moves:best('memory'));setTimeout(()=>{board.innerHTML=`<div class="game-message"><h3>All matched!</h3><p>You finished in ${moves} moves.</p><button class="again">Play again</button></div>`;board.querySelector('.again').onclick=memoryGame},350)}}else{locked=true;setTimeout(()=>{open.forEach(x=>x.classList.remove('open'));open=[];locked=false},700)}}}
}
function jumpGame(){
  let score=0, height=0, velocity=0, obstacle=300, running=true;
  frame('Space Sprint','Press Space to jump over the incoming blocks.',`Distance: 0 · Best: ${best('jump')}`);
  area.insertAdjacentHTML('beforeend','<div class="game-stage jump-stage"><div class="track"></div></div>');
  const track=area.querySelector('.track');
  function draw(){
    track.innerHTML=`<div class="runner" style="bottom:${height}px"></div><div class="obstacle" style="right:${obstacle}px"></div>`;
    area.querySelector('.score').textContent=`Distance: ${score} · Best: ${best('jump')}`;
  }
  function jump(){ if(height === 0){ velocity = 12; }}
  function step(){
    score += 1;
    if(obstacle <= -40){ obstacle = 340 + Math.random() * 80; }
    obstacle -= 5;
    if(height > 0 || velocity !== 0){ height += velocity; velocity -= 0.8; if(height <= 0){ height=0; velocity=0; }}
    if(obstacle < 40 && obstacle > 0 && height < 35){ return gameOver(); }
    draw();
  }
  function gameOver(){
    running=false;
    clearInterval(timer);
    best('jump', score);
    track.innerHTML=`<div class="game-message"><h3>Crash!</h3><p>Distance: ${score}</p><button class="again">Run again</button></div>`;
    area.querySelector('.again').onclick=jumpGame;
    document.removeEventListener('keydown', keyHandler);
  }
  function keyHandler(e){ if(e.code === 'Space'){ e.preventDefault(); jump(); }}
  draw();
  const timer=setInterval(step, 80);
  document.addEventListener('keydown', keyHandler);
  cleanup=()=>{ clearInterval(timer); document.removeEventListener('keydown', keyHandler); };
}
