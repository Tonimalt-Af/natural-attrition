#!/usr/bin/env python3
"""Design-time calibration sketch for Act II (aggregate roll-up model). Not shipped code."""
import math, os, sys
LIAR=int(os.environ.get('LIAR',0)); PBUY0=float(os.environ.get('PBUY0',220)); QUIET=os.environ.get('QUIET')
GROW=[float(x) for x in os.environ.get('GROW','1.15,1.17,1.19').split(',')]
BASE=[float(x) for x in os.environ.get('BASE','2e3,2e5,2e7').split(',')]
YIELD=[float(x) for x in os.environ.get('YIELD','4,500,6e4').split(',')]
cash=4e5; debt=0.0; U=0.0; I=1000.0; own=[0,0,0]; ai=0.0; t=0
Ecap=float(os.environ.get('ECAP',25e6)); 
LAMBDA0=float(os.environ.get('LAM',3.0)); INT=0.06/250
a_k=[0,.15,.35,.70,1.5]; F=0.0; ak=0
pis=570.0
aiLevels=[(0.15,8e5),(0.30,6e6),(0.45,6e7),(0.60,6e8),(0.80,6e9),(1.0,6e10)]
aiIdx=0
log=[]
def B(): return sum(YIELD[i]*own[i] for i in range(3))
def price(E): return PBUY0*(max(E,1000)/1000)**0.12
while t<9000:
    t+=1
    E=U+I
    prof=0.055*U+(0.055+0.45+0.30*ai)*I
    fake=a_k[ak]*prof if LIAR else 0
    F+=fake
    pis=pis*0.97+prof*0.03
    cash+=prof-debt*INT
    # integration
    mv=min(U, B()/0.62)
    U-=mv; I+=mv
    # generators by ROI
    best=None
    for i in range(3):
        c=BASE[i]*GROW[i]**own[i]
        r=YIELD[i]/c
        if cash>=c and (best is None or r>best[0]): best=(r,i,c)
    # only buy gens if unintegrated backlog exists or tier can't be used
    if best and (U>B()*600 or True):
        # keep cash split: spend up to 50% of cash on capacity if backlog large
        if U>B()*30 and best[2]<=cash*0.6:
            own[best[1]]+=1; cash-=best[2]
    # AI initiatives
    if aiIdx<len(aiLevels):
        lv,c=aiLevels[aiIdx]
        if cash>=c*(1+0): cash-=c; ai=lv; aiIdx+=1
    # acquisitions: keep backlog <= 150s of capacity
    lam=LAMBDA0*prof*250
    cap_debt=max(0,lam-debt)
    want=max(0,B()/0.62*150-U) if B()>0 else 20
    p=price(E)
    disc=1/(1+a_k[ak]*0.5) if LIAR else 1
    p*=disc
    afford=(cash*0.7+cap_debt*0.9)/p
    x=min(want,afford)
    if x>=1:
        cost=x*p
        usec=min(cost,cash*0.7); cash-=usec; debt+=cost-usec; U+=x
    # repay debt if leverage high
    if debt>0 and cash>prof*400: 
        pay=min(debt,cash*0.3); debt-=pay; cash-=pay
    if LIAR and E>5e3*(10**ak) and ak<4 : ak+=1
    if t%300==0: log.append((t//60,round(E),round(I),round(B()),round(prof),round(debt/(prof*250+1),2),ai,own[:]))
    if E>=Ecap: break
print("LIAR",LIAR,"end(min)",round(t/60,1),"E",round(E),"pi",round(prof))
if not QUIET:
    print("min E I B profit lev ai gens")
    for l in log: print(*l)
