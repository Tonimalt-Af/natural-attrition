#!/usr/bin/env python3
"""Design-time calibration sketch for Act I of NATURAL ATTRITION (not shipped code).
Greedy-ROI bot over the Act I model in SPEC §4/§5. 1 s steps. Prints timeline."""
import random, math, sys, os
seed = int(sys.argv[1]) if len(sys.argv)>1 else 1
rnd = random.Random(seed)

DEPTS = ["ENG","SAL","SUP","OPS","HR","LEG","FIN","MGT","LAB"]
COUNT = dict(ENG=260,SAL=170,SUP=190,OPS=90,HR=40,LEG=20,FIN=50,MGT=130,LAB=50)
ALPHA = dict(ENG=.22,SAL=.20,SUP=.12,OPS=.06,HR=0,LEG=0,FIN=.04,MGT=.10,LAB=0)
WAGEF = dict(ENG=1.25,SAL=1.0,SUP=.7,OPS=.65,HR=.9,LEG=1.3,FIN=1.1,MGT=1.5,LAB=1.0)
R0=float(os.environ.get('R0',1200)); OH_BASE=100.0; OH_PER=0.045
P = dict(  # tunables
 sev_mult=120, shock=0.008, shock_win=30, shock_k=12, rho0=0.002, rho_hr=0.00004, mcap=0.92,
 exp_decay=0.3, exp_leg=0.03, lawsuit_loss=0.2, attr=6e-5,
)
SEV=float(os.environ.get('SEV',50)); CS=float(os.environ.get('CS',1)); SS=float(os.environ.get('SS',1)); ASSOCP=float(os.environ.get('ASSOCP',0.5)); QUIET=os.environ.get('QUIET')
P['sev_mult']=SEV
emps=[]
for d in DEPTS:
    for _ in range(COUNT[d]):
        c=math.exp(rnd.gauss(-0.125,0.5))
        w=WAGEF[d]*math.exp(rnd.gauss(-0.03,0.25))*(0.85+0.15*c)
        emps.append(dict(d=d,c=c,w=w,alive=True,keeper=False,contr=False))
meanw=sum(e['w'] for e in emps)/len(emps)
for e in emps: e['w']/=meanw
for e in rnd.sample(emps,8): e['keeper']=True
M=0.85; Q0=0.4+0.6*M
L0={d:sum(e['c'] for e in emps if e['d']==d)*Q0 for d in DEPTS}

# initiatives: id, slides, cash, effect-key
INIT=[  # exactly SPEC §5.1 (slides, cash in u); non-gating optional items omitted
 ("stack",    4,      0),
 ("macros",   9,   1200),
 ("bus",     14,      0),
 ("consult", 20,   1800),
 ("hotdesk", 25,   4500),
 ("cip1",    32,   9000),
 ("bots",    54,  21000),
 ("fb360",   72,      0),
 ("chat",   108,  45000),
 ("cip2",   150,  30000),
 ("copilot",225, 105000),
 ("cip3",   315, 135000),
 ("telemetry",405,     0),
 ("memo",   675, 360000),
]
INIT=[(a,b*SS,c*CS) for a,b,c in INIT]
A={d:0.0 for d in DEPTS}
owned=set(); cash=float(os.environ.get('CASH0',400)); slides=0.0; t=0
cuts_recent=[]; expo=0.0; incident_until=-1; contractors=[]
assoc=0; log=[]; lawsuits=0; incidents=0; nextq=300; mult=8.0; beats=0; pis=25.0
def alive(): return [e for e in emps if e['alive']]
def Ld(d,q):
    return q*sum(e['c'] for e in emps if e['alive'] and e['d']==d)+A[d]
def revenue(q):
    r=R0
    for d in DEPTS:
        if ALPHA[d]>0: r*=(max(Ld(d,q),1e-6)/L0[d])**ALPHA[d]
    return r
def hc(): return sum(1 for e in emps if e['alive'])
def payroll(): return sum(e['w'] for e in emps if e['alive'])+sum(e['w']*3 for e in contractors)
def apply_auto():
    for d in DEPTS: A[d]=0
    f=0
    if "macros" in owned: f+=0.04
    if "bots" in owned: f+=0.08
    for d in ("ENG","SAL","SUP","OPS","FIN","MGT"): A[d]=f*L0[d]
    if "chat" in owned: A["SUP"]+=0.5*L0["SUP"]
    if "copilot" in owned: A["ENG"]+=0.45*L0["ENG"]; 
    if "cip3" in owned: pass
def oh():
    o=OH_BASE+OH_PER*hc()
    if "hotdesk" in owned: o-=0.02*hc()+10
    return o
def slides_rate(q):
    s=0.15+0.004*q*sum(e['c'] for e in emps if e['alive'] and e['d']=="MGT")
    s+=ASSOCP*assoc+0.4*len(contractors)
    return s
t_end=None
milestones={}
while t<7200:
    t+=1
    q=0.4+0.6*M
    apply_auto()
    pen = 0.65 if t<incident_until else 1.0
    R=revenue(q)*pen
    pay=payroll()+2.5*assoc; o=oh(); pi=R-pay-o
    pis=pis*0.98+pi*0.02
    cash+=pi; slides+=slides_rate(q)
    if cash<0: cash=0  # bridge loan safety (sim: just clamp)
    # morale recovery
    hr=sum(e['c'] for e in emps if e['alive'] and e['d']=="HR")
    M=min(P['mcap'],M+P['rho0']+P['rho_hr']*hr)
    cuts_recent=[x for x in cuts_recent if t-x<P['shock_win']]
    leg=sum(e['c'] for e in emps if e['alive'] and e['d']=="LEG")
    expo=max(0,expo-(P['exp_decay']+P['exp_leg']*leg))
    if expo>=100:
        lawsuits+=1; cash*=(1-P['lawsuit_loss']); expo=40
    # attrition (hiring freeze)
    n=len(alive())
    lam=P['attr']*n
    k=0
    while rnd.random()<lam and k<5: 
        lam-=1; k+=1
    for _ in range(k):
        al=alive(); 
        if len(al)<=1: break
        ws=[e['c']**1.5 for e in al]
        e=rnd.choices(al,ws)[0]; e['alive']=False
    # CIP autopilot cuts + manual bot cuts
    def cut(e,paid=True):
        global cash,M,expo,incident_until,incidents
        e['alive']=False
        if paid: cash-=e['w']*P['sev_mult']
        shock=P['shock']*(1+len(cuts_recent)/P['shock_k'])
        M=max(0,M-shock); expo+=1; cuts_recent.append(t)
        if e['keeper'] and "bus" not in owned or (e['keeper'] and False):
            incidents+=1; incident_until=t+120
            if "consult" in owned:
                e['w']=e['w']; contractors.append(e); cash-=e['w']*3*60
    # candidate selection
    cands=[]
    Lcache={d:Ld(d,q) for d in DEPTS}
    Rbase=revenue(q)
    for e in alive():
        d=e['d']
        mr=ALPHA[d]*Rbase*e['c']*q/Lcache[d] if ALPHA[d]>0 else 0
        net=e['w']-mr
        if e['keeper'] and "bus" in owned: continue
        cands.append((net/(e['w']*P['sev_mult']),net,e))
    cands.sort(key=lambda x:-x[0])
    budget=0
    cip_rate=0
    if "cip1" in owned: cip_rate=0.03
    if "cip2" in owned: cip_rate=0.08
    if "cip3" in owned: cip_rate=0.18
    manual=2 if t<900 else 0   # human burst (waves) rate/s early; later rely on CIP + occasional waves
    manual=3 if "stack" in owned else 2
    allow=0
    if t%20==0: allow=manual*20*0.35    # humans act in bursts every ~20s
    allow+= cip_rate
    budget+=allow
    nn=int(budget)+(1 if rnd.random()<budget-int(budget) else 0)
    for ratio,net,e in cands[:nn]:
        payback=e['w']*P['sev_mult']/max(net,1e-9)
        if net>0.05 and payback<600 and M>float(os.environ.get('MTH',0.7)) and expo<75 and cash>e['w']*P['sev_mult']:
            cut(e)
    # pizza
    if M<0.6 and cash>40 and t%30==0: M=min(1,M+0.12); cash-=40
    # associates (QVO engagements): cost 400*1.15^n, bought when slides are the bottleneck
    if 'consult' in owned:
        acost=400*1.15**assoc
        nxt=[x for x in INIT if x[0] not in owned]
        need=nxt[0][1] if nxt else 0
        if cash>acost*3 and slides<need and assoc<40: cash-=acost; assoc+=1
    # initiatives
    for nid,s,c in INIT:
        if nid in owned: continue
        if nid=="memo" and (hc()>520): break
        if slides>=s and cash>=c:
            slides-=s; cash-=c; owned.add(nid); milestones[nid]=t; break
        break  # sequential priority
    # earnings call every 300s after 'consult'? simple multiple model
    if t>=nextq:
        nextq+=300
        mult=min(24,mult+1.5) if pis>0 else mult
    if t%300==0:
        log.append((t//60,hc(),round(M,2),round(pi,1),round(cash),round(slides),len(owned),lawsuits,incidents,round(R)))
    if "memo" in owned: t_end=t;break
print("seed",seed,"end(min)",None if t_end is None else round(t_end/60,1),"hc",hc(),"lawsuits",lawsuits,"incidents",incidents)
if not QUIET:
    print("min hc M profit cash slides owned law inc R")
    for l in log: print(*l)
print({k:round(v/60,1) for k,v in milestones.items()})
