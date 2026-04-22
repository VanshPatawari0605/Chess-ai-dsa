/*
 * Chess Engine in C++
 * DSA: Minimax + Alpha-Beta Pruning
 *
 * Compile: g++ -O2 -std=c++17 chess.cpp -o chess
 * Run:     ./chess
 * Input:   moves like e2e4  (from-square to-square)
 */

#include <iostream>
#include <vector>
#include <algorithm>
#include <climits>
#include <string>
using namespace std;

// Piece encoding: positive = White, negative = Black
// 1=Pawn 2=Knight 3=Bishop 4=Rook 5=Queen 6=King
const int PAWN=1,KNIGHT=2,BISHOP=3,ROOK=4,QUEEN=5,KING=6;
const int PIECE_VALUE[]={0,100,320,330,500,900,20000};

const int PAWN_TABLE[8][8]={
  {0,0,0,0,0,0,0,0},{50,50,50,50,50,50,50,50},
  {10,10,20,30,30,20,10,10},{5,5,10,25,25,10,5,5},
  {0,0,0,20,20,0,0,0},{5,-5,-10,0,0,-10,-5,5},
  {5,10,10,-20,-20,10,10,5},{0,0,0,0,0,0,0,0}
};
const int KNIGHT_TABLE[8][8]={
  {-50,-40,-30,-30,-30,-30,-40,-50},{-40,-20,0,0,0,0,-20,-40},
  {-30,0,10,15,15,10,0,-30},{-30,5,15,20,20,15,5,-30},
  {-30,0,15,20,20,15,0,-30},{-30,5,10,15,15,10,5,-30},
  {-40,-20,0,5,5,0,-20,-40},{-50,-40,-30,-30,-30,-30,-40,-50}
};

struct Move { int fr,fc,tr,tc,promo; };

struct GameState {
  int board[8][8];
  bool whiteTurn;
  bool wKC,wQC,bKC,bQC; // castling rights
  int epCol; // en passant column (-1 = none)
};

bool inBounds(int r,int c){return r>=0&&r<8&&c>=0&&c<8;}
int  pType(int p){return abs(p);}
int  pColor(int p){return p>0?1:p<0?-1:0;}

// ─── Move Generation ──────────────────────────────────────────
void addM(vector<Move>&mv,int fr,int fc,int tr,int tc,int pr=0){mv.push_back({fr,fc,tr,tc,pr});}

void genPawn(const GameState&gs,int r,int c,vector<Move>&mv){
  int p=gs.board[r][c],dir=p>0?-1:1,start=p>0?6:1,promoR=p>0?0:7;
  if(inBounds(r+dir,c)&&gs.board[r+dir][c]==0){
    if(r+dir==promoR){for(int pr:{QUEEN,ROOK,BISHOP,KNIGHT})addM(mv,r,c,r+dir,c,pr);}
    else{addM(mv,r,c,r+dir,c);if(r==start&&gs.board[r+2*dir][c]==0)addM(mv,r,c,r+2*dir,c);}
  }
  for(int dc:{-1,1}){
    int nr=r+dir,nc=c+dc;if(!inBounds(nr,nc))continue;
    int tgt=gs.board[nr][nc];
    bool isC=pColor(tgt)==-pColor(p),isEP=gs.epCol==nc&&nr==(p>0?2:5);
    if(isC||isEP){if(nr==promoR)for(int pr:{QUEEN,ROOK,BISHOP,KNIGHT})addM(mv,r,c,nr,nc,pr);else addM(mv,r,c,nr,nc);}
  }
}

void genSlide(const GameState&gs,int r,int c,vector<pair<int,int>>dirs,vector<Move>&mv){
  int col=pColor(gs.board[r][c]);
  for(auto[dr,dc]:dirs){int nr=r+dr,nc=c+dc;while(inBounds(nr,nc)){int t=gs.board[nr][nc];if(pColor(t)==col)break;addM(mv,r,c,nr,nc);if(t)break;nr+=dr;nc+=dc;}}
}

void genKnight(const GameState&gs,int r,int c,vector<Move>&mv){
  int off[8][2]={{-2,-1},{-2,1},{-1,-2},{-1,2},{1,-2},{1,2},{2,-1},{2,1}};
  for(auto&o:off){int nr=r+o[0],nc=c+o[1];if(inBounds(nr,nc)&&pColor(gs.board[nr][nc])!=pColor(gs.board[r][c]))addM(mv,r,c,nr,nc);}
}

void genKing(const GameState&gs,int r,int c,vector<Move>&mv){
  int col=pColor(gs.board[r][c]);
  for(int dr=-1;dr<=1;dr++)for(int dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;int nr=r+dr,nc=c+dc;if(inBounds(nr,nc)&&pColor(gs.board[nr][nc])!=col)addM(mv,r,c,nr,nc);}
  bool w=col>0;
  if(w&&r==7&&c==4){
    if(gs.wKC&&!gs.board[7][5]&&!gs.board[7][6])addM(mv,7,4,7,6);
    if(gs.wQC&&!gs.board[7][3]&&!gs.board[7][2]&&!gs.board[7][1])addM(mv,7,4,7,2);
  }
  if(!w&&r==0&&c==4){
    if(gs.bKC&&!gs.board[0][5]&&!gs.board[0][6])addM(mv,0,4,0,6);
    if(gs.bQC&&!gs.board[0][3]&&!gs.board[0][2]&&!gs.board[0][1])addM(mv,0,4,0,2);
  }
}

vector<Move> genMoves(const GameState&gs,bool forWhite){
  vector<Move> mv;
  for(int r=0;r<8;r++)for(int c=0;c<8;c++){
    int p=gs.board[r][c];if(!p||(p>0)!=forWhite)continue;
    int t=pType(p);
    if(t==PAWN)  genPawn(gs,r,c,mv);
    if(t==KNIGHT)genKnight(gs,r,c,mv);
    if(t==BISHOP)genSlide(gs,r,c,{{-1,-1},{-1,1},{1,-1},{1,1}},mv);
    if(t==ROOK)  genSlide(gs,r,c,{{-1,0},{1,0},{0,-1},{0,1}},mv);
    if(t==QUEEN) genSlide(gs,r,c,{{-1,-1},{-1,1},{1,-1},{1,1},{-1,0},{1,0},{0,-1},{0,1}},mv);
    if(t==KING)  genKing(gs,r,c,mv);
  }
  return mv;
}

// ─── Apply Move ───────────────────────────────────────────────
GameState applyMove(GameState gs,const Move&m){
  int piece=gs.board[m.fr][m.fc],type=pType(piece),color=pColor(piece);
  gs.board[m.tr][m.tc]=m.promo?(color>0?m.promo:-m.promo):piece;
  gs.board[m.fr][m.fc]=0;
  if(type==PAWN&&m.fc!=m.tc&&!gs.board[m.tr][m.tc-m.tc+m.tc]) // en passant
    gs.board[m.tr+(piece>0?1:-1)][m.tc]=0;
  gs.epCol=(type==PAWN&&abs(m.tr-m.fr)==2)?m.tc:-1;
  if(type==KING){
    if(m.tc-m.fc==2){gs.board[m.fr][5]=gs.board[m.fr][7];gs.board[m.fr][7]=0;}
    if(m.fc-m.tc==2){gs.board[m.fr][3]=gs.board[m.fr][0];gs.board[m.fr][0]=0;}
    if(color>0){gs.wKC=gs.wQC=false;}else{gs.bKC=gs.bQC=false;}
  }
  if(type==ROOK){
    if(m.fr==7&&m.fc==7)gs.wKC=false;if(m.fr==7&&m.fc==0)gs.wQC=false;
    if(m.fr==0&&m.fc==7)gs.bKC=false;if(m.fr==0&&m.fc==0)gs.bQC=false;
  }
  gs.whiteTurn=!gs.whiteTurn;
  return gs;
}

// ─── Check ────────────────────────────────────────────────────
bool isInCheck(const GameState&gs,bool whiteKing){
  int kr=-1,kc=-1,target=whiteKing?KING:-KING;
  for(int r=0;r<8;r++)for(int c=0;c<8;c++)if(gs.board[r][c]==target){kr=r;kc=c;}
  if(kr<0)return true;
  auto attacks=genMoves(gs,!whiteKing);
  for(auto&m:attacks)if(m.tr==kr&&m.tc==kc)return true;
  return false;
}

vector<Move> getLegal(const GameState&gs,bool forWhite){
  vector<Move> legal;
  for(auto&m:genMoves(gs,forWhite)){GameState nx=applyMove(gs,m);if(!isInCheck(nx,forWhite))legal.push_back(m);}
  return legal;
}

// ─── Evaluation ───────────────────────────────────────────────
int evaluate(const GameState&gs){
  int score=0;
  for(int r=0;r<8;r++)for(int c=0;c<8;c++){
    int p=gs.board[r][c];if(!p)continue;
    int t=pType(p),col=pColor(p),pr=col>0?r:7-r;
    int v=PIECE_VALUE[t];
    if(t==PAWN)  v+=PAWN_TABLE[pr][c];
    if(t==KNIGHT)v+=KNIGHT_TABLE[pr][c];
    score+=col*v;
  }
  return score;
}

// ─── MINIMAX + ALPHA-BETA PRUNING ─────────────────────────────
/*
 *  alpha = best White can guarantee  (init: -INF)
 *  beta  = best Black can guarantee  (init: +INF)
 *
 *  Prune when alpha >= beta:
 *    MAX node → beta-cutoff  (Black won't allow this path)
 *    MIN node → alpha-cutoff (White already has better)
 *
 *  Complexity: O(b^d) → O(b^(d/2)) with pruning
 */
int nodesSearched=0;

int minimax(GameState gs,int depth,int alpha,int beta,bool maximizing){
  nodesSearched++;
  if(depth==0)return evaluate(gs);
  auto moves=getLegal(gs,maximizing);
  if(moves.empty())return isInCheck(gs,maximizing)?(maximizing?-100000:100000):0;

  if(maximizing){
    int best=INT_MIN;
    for(auto&m:moves){
      best=max(best,minimax(applyMove(gs,m),depth-1,alpha,beta,false));
      alpha=max(alpha,best);
      if(beta<=alpha)break; // ← Beta cutoff — PRUNE
    }
    return best;
  } else {
    int best=INT_MAX;
    for(auto&m:moves){
      best=min(best,minimax(applyMove(gs,m),depth-1,alpha,beta,true));
      beta=min(beta,best);
      if(beta<=alpha)break; // ← Alpha cutoff — PRUNE
    }
    return best;
  }
}

Move getBestMove(const GameState&gs,int depth,bool forWhite){
  nodesSearched=0;
  auto moves=getLegal(gs,forWhite);
  Move best=moves[0];int bestVal=forWhite?INT_MIN:INT_MAX;
  for(auto&m:moves){
    int val=minimax(applyMove(gs,m),depth-1,INT_MIN,INT_MAX,!forWhite);
    if(forWhite?val>bestVal:val<bestVal){bestVal=val;best=m;}
  }
  return best;
}

// ─── Initial Board ────────────────────────────────────────────
GameState initialState(){
  GameState gs;gs.whiteTurn=true;gs.wKC=gs.wQC=gs.bKC=gs.bQC=true;gs.epCol=-1;
  int back[8]={ROOK,KNIGHT,BISHOP,QUEEN,KING,BISHOP,KNIGHT,ROOK};
  for(int c=0;c<8;c++){gs.board[0][c]=-back[c];gs.board[1][c]=-PAWN;gs.board[6][c]=PAWN;gs.board[7][c]=back[c];}
  for(int r=2;r<6;r++)for(int c=0;c<8;c++)gs.board[r][c]=0;
  return gs;
}

// ─── CLI ──────────────────────────────────────────────────────
string glyph(int p){const string g=".PNBRQK";if(!p)return".";char c=g[abs(p)];return string(1,p>0?toupper(c):tolower(c));}

void printBoard(const GameState&gs){
  cout<<"\n  a b c d e f g h\n";
  for(int r=0;r<8;r++){cout<<(8-r)<<" ";for(int c=0;c<8;c++)cout<<glyph(gs.board[r][c])<<" ";cout<<(8-r)<<"\n";}
  cout<<"  a b c d e f g h\n\n";
}

int main(){
  cout<<"Chess Engine — Minimax + Alpha-Beta Pruning\n";
  cout<<"Depth 3 | You = White | AI = Black\n";
  cout<<"Enter moves as: e2e4  (type 'quit' to exit)\n\n";

  GameState gs=initialState();
  const int DEPTH=3;

  while(true){
    printBoard(gs);
    if(gs.whiteTurn){
      cout<<"Your move: ";string input;cin>>input;
      if(input=="quit")break;
      if(input.size()<4){cout<<"Invalid.\n";continue;}
      int fc=input[0]-'a',fr=8-(input[1]-'0'),tc=input[2]-'a',tr=8-(input[3]-'0');
      if(!inBounds(fr,fc)||!inBounds(tr,tc)){cout<<"Out of bounds.\n";continue;}
      Move m={fr,fc,tr,tc,0};
      if(pType(gs.board[fr][fc])==PAWN&&tr==0)m.promo=QUEEN;
      GameState nx=applyMove(gs,m);
      if(isInCheck(nx,true)){cout<<"Leaves your king in check!\n";continue;}
      gs=nx;
    } else {
      cout<<"AI thinking (depth="<<DEPTH<<")...\n";
      nodesSearched=0;
      Move best=getBestMove(gs,DEPTH,false);
      cout<<"AI: "<<(char)('a'+best.fc)<<(8-best.fr)<<(char)('a'+best.tc)<<(8-best.tr)
          <<" | nodes="<<nodesSearched<<"\n";
      gs=applyMove(gs,best);
    }
    // Game over check
    auto legal=getLegal(gs,gs.whiteTurn);
    if(legal.empty()){
      printBoard(gs);
      if(isInCheck(gs,gs.whiteTurn))cout<<(gs.whiteTurn?"Black":"White")<<" wins by checkmate!\n";
      else cout<<"Stalemate — Draw\n";
      break;
    }
  }
  return 0;
}