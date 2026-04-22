// ============================================================
//  chess.js — Chess Logic + Minimax + Alpha-Beta Pruning
// ============================================================

const PIECE = { EMPTY:0, PAWN:1, KNIGHT:2, BISHOP:3, ROOK:4, QUEEN:5, KING:6 };
const WHITE = 1, BLACK = -1;
const PIECE_VALUE = [0, 100, 320, 330, 500, 900, 20000];

const PAWN_TABLE = [
  [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],
  [10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],
  [0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],
  [5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]
];
const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],
  [-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
  [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],
  [-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
];
const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
  [-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],
  [-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],
  [-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]
];
const ROOK_TABLE = [
  [0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],
  [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
  [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
  [-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]
];

const GLYPHS = {
  1:'♙', 2:'♘', 3:'♗', 4:'♖', 5:'♕', 6:'♔',
  '-1':'♟','-2':'♞','-3':'♝','-4':'♜','-5':'♛','-6':'♚'
};

// ─── Helpers ──────────────────────────────────────────────────
const inBounds   = (r,c) => r>=0&&r<8&&c>=0&&c<8;
const pieceType  = p => Math.abs(p);
const pieceColor = p => p>0?WHITE:p<0?BLACK:0;
const isEmpty    = p => p===0;
const cloneBoard = b => b.map(r=>[...r]);
const cloneState = gs => ({
  board:cloneBoard(gs.board),
  whiteTurn:gs.whiteTurn,
  whiteKingsideCastle:gs.whiteKingsideCastle,
  whiteQueensideCastle:gs.whiteQueensideCastle,
  blackKingsideCastle:gs.blackKingsideCastle,
  blackQueensideCastle:gs.blackQueensideCastle,
  enPassantCol:gs.enPassantCol
});

// ─── Initial State ────────────────────────────────────────────
function initialState() {
  const board = Array.from({length:8},()=>Array(8).fill(0));
  const back  = [4,2,3,5,6,3,2,4];
  for(let c=0;c<8;c++){
    board[0][c]=-back[c]; board[1][c]=-1;
    board[6][c]=1;        board[7][c]=back[c];
  }
  return {board,whiteTurn:true,
    whiteKingsideCastle:true,whiteQueensideCastle:true,
    blackKingsideCastle:true,blackQueensideCastle:true,
    enPassantCol:-1};
}

// ─── Move Generation ──────────────────────────────────────────
function genPawnMoves(gs,r,c,moves){
  const p=gs.board[r][c],dir=p>0?-1:1,start=p>0?6:1,promoR=p>0?0:7;
  if(inBounds(r+dir,c)&&isEmpty(gs.board[r+dir][c])){
    if(r+dir===promoR){
      for(const pr of[5,4,3,2]) moves.push({fr:r,fc:c,tr:r+dir,tc:c,promo:pr});
    } else {
      moves.push({fr:r,fc:c,tr:r+dir,tc:c,promo:0});
      if(r===start&&isEmpty(gs.board[r+2*dir][c]))
        moves.push({fr:r,fc:c,tr:r+2*dir,tc:c,promo:0});
    }
  }
  for(const dc of[-1,1]){
    const nr=r+dir,nc=c+dc;
    if(!inBounds(nr,nc)) continue;
    const tgt=gs.board[nr][nc];
    const isC=pieceColor(tgt)===-pieceColor(p);
    const isEP=gs.enPassantCol===nc&&nr===(p>0?2:5);
    if(isC||isEP){
      if(nr===promoR){
        for(const pr of[5,4,3,2]) moves.push({fr:r,fc:c,tr:nr,tc:nc,promo:pr});
      } else moves.push({fr:r,fc:c,tr:nr,tc:nc,promo:0});
    }
  }
}

function genSliding(gs,r,c,dirs,moves){
  const col=pieceColor(gs.board[r][c]);
  for(const[dr,dc]of dirs){
    let nr=r+dr,nc=c+dc;
    while(inBounds(nr,nc)){
      const t=gs.board[nr][nc];
      if(pieceColor(t)===col) break;
      moves.push({fr:r,fc:c,tr:nr,tc:nc,promo:0});
      if(!isEmpty(t)) break;
      nr+=dr; nc+=dc;
    }
  }
}

function genKnightMoves(gs,r,c,moves){
  for(const[dr,dc]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
    const nr=r+dr,nc=c+dc;
    if(inBounds(nr,nc)&&pieceColor(gs.board[nr][nc])!==pieceColor(gs.board[r][c]))
      moves.push({fr:r,fc:c,tr:nr,tc:nc,promo:0});
  }
}

function genKingMoves(gs,r,c,moves){
  const col=pieceColor(gs.board[r][c]);
  for(let dr=-1;dr<=1;dr++)
    for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc) continue;
      const nr=r+dr,nc=c+dc;
      if(inBounds(nr,nc)&&pieceColor(gs.board[nr][nc])!==col)
        moves.push({fr:r,fc:c,tr:nr,tc:nc,promo:0});
    }
  if(col===WHITE&&r===7&&c===4){
    if(gs.whiteKingsideCastle&&isEmpty(gs.board[7][5])&&isEmpty(gs.board[7][6]))
      moves.push({fr:7,fc:4,tr:7,tc:6,promo:0});
    if(gs.whiteQueensideCastle&&isEmpty(gs.board[7][3])&&isEmpty(gs.board[7][2])&&isEmpty(gs.board[7][1]))
      moves.push({fr:7,fc:4,tr:7,tc:2,promo:0});
  }
  if(col===BLACK&&r===0&&c===4){
    if(gs.blackKingsideCastle&&isEmpty(gs.board[0][5])&&isEmpty(gs.board[0][6]))
      moves.push({fr:0,fc:4,tr:0,tc:6,promo:0});
    if(gs.blackQueensideCastle&&isEmpty(gs.board[0][3])&&isEmpty(gs.board[0][2])&&isEmpty(gs.board[0][1]))
      moves.push({fr:0,fc:4,tr:0,tc:2,promo:0});
  }
}

function generateMoves(gs,forWhite){
  const moves=[];
  for(let r=0;r<8;r++)
    for(let c=0;c<8;c++){
      const p=gs.board[r][c];
      if(isEmpty(p)||(p>0)!==forWhite) continue;
      const t=pieceType(p);
      if(t===1) genPawnMoves(gs,r,c,moves);
      if(t===2) genKnightMoves(gs,r,c,moves);
      if(t===3) genSliding(gs,r,c,[[-1,-1],[-1,1],[1,-1],[1,1]],moves);
      if(t===4) genSliding(gs,r,c,[[-1,0],[1,0],[0,-1],[0,1]],moves);
      if(t===5) genSliding(gs,r,c,[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],moves);
      if(t===6) genKingMoves(gs,r,c,moves);
    }
  return moves;
}

// ─── Apply Move ───────────────────────────────────────────────
function applyMove(gs,m){
  const next=cloneState(gs);
  const piece=next.board[m.fr][m.fc];
  const type=pieceType(piece);
  const color=pieceColor(piece);
  next.board[m.tr][m.tc]=m.promo?(color===WHITE?m.promo:-m.promo):piece;
  next.board[m.fr][m.fc]=0;
  // en passant capture
  if(type===1&&m.fc!==m.tc&&isEmpty(gs.board[m.tr][m.tc]))
    next.board[m.tr+(piece>0?1:-1)][m.tc]=0;
  // en passant flag
  next.enPassantCol=(type===1&&Math.abs(m.tr-m.fr)===2)?m.tc:-1;
  // castling
  if(type===6){
    if(m.tc-m.fc===2){next.board[m.fr][5]=next.board[m.fr][7];next.board[m.fr][7]=0;}
    if(m.fc-m.tc===2){next.board[m.fr][3]=next.board[m.fr][0];next.board[m.fr][0]=0;}
    if(color===WHITE){next.whiteKingsideCastle=next.whiteQueensideCastle=false;}
    else{next.blackKingsideCastle=next.blackQueensideCastle=false;}
  }
  if(type===4){
    if(m.fr===7&&m.fc===7)next.whiteKingsideCastle=false;
    if(m.fr===7&&m.fc===0)next.whiteQueensideCastle=false;
    if(m.fr===0&&m.fc===7)next.blackKingsideCastle=false;
    if(m.fr===0&&m.fc===0)next.blackQueensideCastle=false;
  }
  next.whiteTurn=!next.whiteTurn;
  return next;
}

// ─── Check Detection ──────────────────────────────────────────
function findKing(board,white){
  const t=white?6:-6;
  for(let r=0;r<8;r++)
    for(let c=0;c<8;c++)
      if(board[r][c]===t) return[r,c];
  return null;
}

function isInCheck(gs,whiteKing){
  const pos=findKing(gs.board,whiteKing);
  if(!pos) return true;
  const[kr,kc]=pos;
  return generateMoves(gs,!whiteKing).some(m=>m.tr===kr&&m.tc===kc);
}

function getLegalMoves(gs,forWhite){
  return generateMoves(gs,forWhite).filter(m=>!isInCheck(applyMove(gs,m),forWhite));
}

// ─── Evaluation ───────────────────────────────────────────────
function evaluate(gs){
  let s=0;
  for(let r=0;r<8;r++)
    for(let c=0;c<8;c++){
      const p=gs.board[r][c];
      if(!p) continue;
      const t=Math.abs(p),col=pieceColor(p),pr=col===WHITE?r:7-r;
      let v=PIECE_VALUE[t];
      if(t===1)v+=PAWN_TABLE[pr][c];
      if(t===2)v+=KNIGHT_TABLE[pr][c];
      if(t===3)v+=BISHOP_TABLE[pr][c];
      if(t===4)v+=ROOK_TABLE[pr][c];
      s+=col*v;
    }
  return s;
}

// ─── MINIMAX + ALPHA-BETA PRUNING ─────────────────────────────
/*
 *  maximizing = White's turn (wants highest score)
 *  minimizing = Black's turn (wants lowest score)
 *
 *  alpha = best score White is guaranteed so far  (starts -Infinity)
 *  beta  = best score Black is guaranteed so far  (starts +Infinity)
 *
 *  PRUNE when alpha >= beta:
 *    In MAX node: beta-cutoff  (Black won't let us reach this)
 *    In MIN node: alpha-cutoff (White already has better option)
 *
 *  Complexity:
 *    Without pruning : O(b^d)       b≈30 branching factor
 *    With pruning    : O(b^(d/2))   doubles effective depth!
 */
let nodesSearched = 0;

function minimax(gs, depth, alpha, beta, maximizing) {
  nodesSearched++;
  if(depth===0) return evaluate(gs);

  const moves=getLegalMoves(gs,maximizing);
  if(moves.length===0){
    if(isInCheck(gs,maximizing)) return maximizing?-100000+depth:100000-depth;
    return 0; // stalemate
  }

  if(maximizing){
    let best=-Infinity;
    for(const m of moves){
      best=Math.max(best,minimax(applyMove(gs,m),depth-1,alpha,beta,false));
      alpha=Math.max(alpha,best);
      if(beta<=alpha) break; // ← Beta cutoff — PRUNE
    }
    return best;
  } else {
    let best=+Infinity;
    for(const m of moves){
      best=Math.min(best,minimax(applyMove(gs,m),depth-1,alpha,beta,true));
      beta=Math.min(beta,best);
      if(beta<=alpha) break; // ← Alpha cutoff — PRUNE
    }
    return best;
  }
}

function getBestMove(gs,depth,forWhite){
  nodesSearched=0;
  const moves=getLegalMoves(gs,forWhite);
  if(!moves.length) return null;
  let bestMove=null,bestVal=forWhite?-Infinity:+Infinity;
  for(const m of moves){
    const val=minimax(applyMove(gs,m),depth-1,-Infinity,+Infinity,!forWhite);
    if(forWhite?val>bestVal:val<bestVal){bestVal=val;bestMove=m;}
  }
  return{move:bestMove,eval:bestVal};
}

// ══════════════════════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════════════════════
let gameState   = initialState();
let history     = [];
let selected    = null;
let legalDests  = [];
let lastMove    = null;
let gameOver    = false;
let aiThinking  = false;
let playerColor = 'white';
let moveLogArr  = [];

const boardEl  = document.getElementById('board');
const statusEl = document.getElementById('status-text');
const logEl    = document.getElementById('move-log');

const getDepth = () => parseInt(document.getElementById('ai-depth').value);
const colName  = c => 'abcdefgh'[c];
const rowName  = r => 8-r;
const moveName = m => colName(m.fc)+rowName(m.fr)+colName(m.tc)+rowName(m.tr)+(m.promo?'='+['','','N','B','R','Q'][m.promo]:'');

// ─── Render ───────────────────────────────────────────────────
function renderBoard(){
  boardEl.innerHTML='';
  const forWhite=gameState.whiteTurn;
  const inCheckFlag=isInCheck(gameState,forWhite);
  const kingPos=findKing(gameState.board,forWhite);
  for(let r=0;r<8;r++)
    for(let c=0;c<8;c++){
      const sq=document.createElement('div');
      sq.className='sq '+((r+c)%2===0?'light':'dark');
      if(selected&&selected.r===r&&selected.c===c) sq.classList.add('selected');
      else if(lastMove&&lastMove.fr===r&&lastMove.fc===c) sq.classList.add('last-from');
      else if(lastMove&&lastMove.tr===r&&lastMove.tc===c) sq.classList.add('last-to');
      if(inCheckFlag&&kingPos&&kingPos[0]===r&&kingPos[1]===c) sq.classList.add('in-check');
      if(selected&&legalDests.some(d=>d.tr===r&&d.tc===c)){
        if(!isEmpty(gameState.board[r][c])) sq.classList.add('legal-capture');
        else sq.classList.add('legal-move');
      }
      const p=gameState.board[r][c];
      if(p){const span=document.createElement('span');span.className='piece';span.textContent=GLYPHS[p]||'?';sq.appendChild(span);}
      sq.addEventListener('click',()=>onSquareClick(r,c));
      boardEl.appendChild(sq);
    }
}

function updateStatus(){
  const legal=getLegalMoves(gameState,gameState.whiteTurn);
  const check=isInCheck(gameState,gameState.whiteTurn);
  const turn=gameState.whiteTurn?'White':'Black';
  const tc=gameState.whiteTurn?'turn-white':'turn-black';
  if(legal.length===0){
    const msg=check?`Checkmate! ${gameState.whiteTurn?'Black':'White'} wins 🏆`:'Stalemate — Draw';
    statusEl.innerHTML=`<span class="highlight">${msg}</span>`;
    showOverlay(check?(gameState.whiteTurn?'Black Wins!':'White Wins!'):'Stalemate!',check?'':'It\'s a draw');
    gameOver=true; return;
  }
  let s=`<span class="${tc}">${turn}</span> to move`;
  if(check) s+=' — <span class="highlight">⚠ Check!</span>';
  if(aiThinking) s+='<br/><span style="color:#888;font-size:10px">AI thinking…</span>';
  statusEl.innerHTML=s;
}

function showOverlay(title,msg){
  document.getElementById('overlay-title').textContent=title;
  document.getElementById('overlay-msg').textContent=msg;
  document.getElementById('overlay').classList.add('show');
}

function addMoveToLog(m,forWhite){
  const name=moveName(m);
  if(forWhite){moveLogArr.push({white:name,black:''});}
  else{if(moveLogArr.length)moveLogArr[moveLogArr.length-1].black=name;else moveLogArr.push({white:'…',black:name});}
  logEl.innerHTML=moveLogArr.length
    ?moveLogArr.map((e,i)=>`<div class="log-move"><span class="log-num">${i+1}.</span><span class="log-w">${e.white}</span><span class="log-b">${e.black}</span></div>`).join('')
    :'<span style="color:#333">No moves yet</span>';
  logEl.scrollTop=logEl.scrollHeight;
}

function updateStats(nodes,ms,depth,ev){
  document.getElementById('stat-nodes').textContent=nodes.toLocaleString();
  document.getElementById('stat-time').textContent=ms+'ms';
  document.getElementById('stat-depth').textContent=depth;
  document.getElementById('stat-eval').textContent=(ev>=0?'+':'')+ev;
}

// ─── Promotion ────────────────────────────────────────────────
function askPromotion(forWhite){
  return new Promise(resolve=>{
    const picker=document.getElementById('promo-picker');
    const pieces=document.getElementById('promo-pieces');
    const opts=forWhite?[[5,'♕'],[4,'♖'],[3,'♗'],[2,'♘']]:[[5,'♛'],[4,'♜'],[3,'♝'],[2,'♞']];
    pieces.innerHTML='';
    for(const[type,glyph]of opts){
      const sq=document.createElement('div');
      sq.className='promo-sq';sq.textContent=glyph;
      sq.onclick=()=>{picker.classList.remove('show');resolve(type);};
      pieces.appendChild(sq);
    }
    picker.classList.add('show');
  });
}

// ─── Input ────────────────────────────────────────────────────
async function onSquareClick(r,c){
  if(gameOver||aiThinking) return;
  const humanWhite=playerColor==='white';
  if(gameState.whiteTurn!==humanWhite) return;
  const piece=gameState.board[r][c];
  if(selected){
    const legal=legalDests.filter(d=>d.tr===r&&d.tc===c);
    if(legal.length){
      let m=legal[0];
      if(legal.length>1){const pr=await askPromotion(humanWhite);m=legal.find(d=>d.promo===pr)||legal[0];}
      await makeMove(m,humanWhite); return;
    }
  }
  if(!isEmpty(piece)&&(piece>0)===humanWhite){
    selected=({r,c});
    legalDests=getLegalMoves(gameState,humanWhite).filter(m=>m.fr===r&&m.fc===c);
    renderBoard(); return;
  }
  selected=null;legalDests=[];renderBoard();
}

async function makeMove(m,wasWhite){
  history.push(cloneState(gameState));
  gameState=applyMove(gameState,m);
  lastMove=m;selected=null;legalDests=[];
  addMoveToLog(m,wasWhite);
  renderBoard();updateStatus();
  if(gameOver) return;
  await triggerAI();
}

async function triggerAI(){
  const aiWhite=playerColor!=='white';
  if(gameState.whiteTurn!==aiWhite||gameOver) return;
  aiThinking=true;updateStatus();renderBoard();
  await new Promise(r=>setTimeout(r,50));
  const depth=getDepth();
  const t0=performance.now();
  const result=getBestMove(gameState,depth,aiWhite);
  const ms=Math.round(performance.now()-t0);
  aiThinking=false;
  if(!result||!result.move){updateStatus();return;}
  updateStats(nodesSearched,ms,depth,result.eval);
  history.push(cloneState(gameState));
  gameState=applyMove(gameState,result.move);
  lastMove=result.move;
  addMoveToLog(result.move,aiWhite);
  renderBoard();updateStatus();
}

// ─── New Game / Undo ──────────────────────────────────────────
function newGame(){
  gameState=initialState();history=[];selected=null;legalDests=[];
  lastMove=null;gameOver=false;aiThinking=false;moveLogArr=[];
  playerColor=document.getElementById('player-color').value;
  document.getElementById('overlay').classList.remove('show');
  ['stat-nodes','stat-time','stat-depth','stat-eval'].forEach(id=>document.getElementById(id).textContent='—');
  logEl.innerHTML='<span style="color:#333">No moves yet</span>';
  renderBoard();updateStatus();
  if(playerColor==='black') setTimeout(()=>triggerAI(),200);
}

function undoMove(){
  if(history.length<2) return;
  history.pop();history.pop();
  gameState=cloneState(history[history.length-1]||initialState());
  if(moveLogArr.length){moveLogArr[moveLogArr.length-1].black='';if(!moveLogArr[moveLogArr.length-1].white)moveLogArr.pop();if(moveLogArr.length)moveLogArr.pop();}
  lastMove=null;selected=null;legalDests=[];gameOver=false;
  logEl.innerHTML=moveLogArr.length?moveLogArr.map((e,i)=>`<div class="log-move"><span class="log-num">${i+1}.</span><span class="log-w">${e.white}</span><span class="log-b">${e.black}</span></div>`).join(''):'<span style="color:#333">No moves yet</span>';
  renderBoard();updateStatus();
}

// ─── Init ─────────────────────────────────────────────────────
newGame();