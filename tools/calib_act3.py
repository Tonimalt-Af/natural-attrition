#!/usr/bin/env python3
"""Design-time calibration sketch for Acts II+III (aggregate). Not shipped code.
Continues the roll-up past 25M employees into the demand-leak regime (Closed Loop)."""
import math, os
QUIET=os.environ.get('QUIET'); PBUY0=float(os.environ.get('PBUY0',210))
RACK_BASE=float(os.environ.get('RACK_BASE',3e7)); RACK_Y=float(os.environ.get('RACK_Y',2e5)); RACK_G=float(os.environ.get('RACK_G',1.12))
CREDIT=float(os.environ.get('CREDIT',0.10)); EISS=float(os.environ.get('EISS',2e-5)); EPS=float(os.environ.get('EPS',0.9))
SYNTH_ON=int(os.environ.get('SYNTH',1))
N0=150e6
GROW=[1.15,1.17,1.19,1.21]; BASE=[2e3,2e5,2e7,2e9]; YIELD=[4,500,6e4,8e6]
cash=4e5; debt=0.0; U=0.0; I=1000.0; own=[0,0,0,0]; ai=0.0; racks=0; t=0; HD=0.0
aiLevels=[(0.15,8e5),(0.30,5e6),(0.45,5e7),(0.60,5e8),(0.80,3e9),(1.0,1.2e10)]; aiIdx=0
log=[]; t2=None; crises=0; slump_until=-1
def B(): return sum(YIELD[i]*own[i] for i in range(4))
def price(E):
    phi=min(E/N0,0.995)
    return PBUY0*(max(E,1000)/1000)**0.12/ (1-phi)**0.5
pis=570.0; pis_rep=570.0
while t<18000:
    t+=1
    E=U+I; phi=E/N0
    cuts=I*(0.62+0.30*ai)
    if t2 is None and E>=25e6: t2=t
    c = CREDIT if t2 else 0.0
    leak=EPS*phi*phi*cuts
    xc_rev=c*1.2*E
    base=0.055*U+(0.055+0.45+0.30*ai)*I
    real=base-leak+xc_rev - 0.02*RACK_Y*racks - debt*0.06/250
    slump = 0.4 if t<slump_until else 1.0
    real*= (slump if real>0 else 1)
    synth_rev=RACK_Y*racks if SYNTH_ON else 0
    rep=real+synth_rev
    pis=pis*0.97+real*0.03; pis_rep=pis_rep*0.97+rep*0.03
    mc_rep=max(pis_rep,0)*250*20
    cash+=real+EISS*mc_rep
    HD+=xc_rev*0.5-0.002*HD
    if HD/(N0*250)>1.0 and t>=slump_until:
        crises+=1; slump_until=t+300; HD*=0.4
    if cash<0:
        cash=0
    mv=min(U,B()/0.62); U-=mv; I+=mv
    # capacity gens
    best=None
    for i in range(4):
        cst=BASE[i]*GROW[i]**own[i]; r=YIELD[i]/cst
        if cash>=cst and (best is None or r>best[0]): best=(r,i,cst)
    if best and U>B()*30 and best[2]<=max(0,cash-reserve)*0.6: own[best[1]]+=1; cash-=best[2]
    reserve=0.0
    if aiIdx<len(aiLevels):
        lv,cc=aiLevels[aiIdx]
        dai=lv-ai
        payback=cc/max(0.3*dai*I,1e-9)
        if cash>=cc and payback<=600: cash-=cc; ai=lv; aiIdx+=1
    # racks when demand leak hurts
    if SYNTH_ON and t2 and leak>0.15*base:
        cst=RACK_BASE*RACK_G**racks
        if cash>=cst: cash-=cst; racks+=1
    lam=3.0*max(pis_rep,0)*250
    capd=max(0,lam-debt)
    want=max(0,B()/0.62*150-U) if B()>0 else 20
    p=price(E)
    afford=(max(0,cash-reserve)*0.7+capd*0.9)/p if reserve==0 else max(0,cash-reserve)*0.7/p
    x=min(want,afford,N0*0.995-E)
    if x>=1:
        cost=x*p; uc=min(cost,cash*0.7); cash-=uc; debt+=cost-uc; U+=x
    if debt>0 and cash>max(real,0)*400:
        pay=min(debt,cash*0.3); debt-=pay; cash-=pay
    if t%300==0: log.append((t//60,round(E/1e6,2),round(phi,2),round(cuts/E if E else 0,2),round(real/1e6,2),round(rep/1e6,2),racks,round(HD/(N0*250),2),crises,ai,own[:]))
    if E>=0.98*N0 and cuts/E>0.8: break
print("end(min)",round(t/60,1),"phase2->3 at",None if t2 is None else round(t2/60,1),"crises",crises,"racks",racks)
if not QUIET:
    print("min E(M) phi cut% real(M) rep(M) racks HDratio crises ai gens")
    for l in log: print(*l)
