import random, math, importlib.util, sys, os
os.environ['QUIET']='1'
# replicate employee generation from calib_act1 without running the sim
src=open('calib_act1.py').read().split("A={d:0.0")[0]
ns={}
sys.argv=['x','1']
exec(src,ns)
emps=ns['emps']; DEPTS=ns['DEPTS']; ALPHA=ns['ALPHA']; L0=ns['L0']; R0=ns['R0']; q=0.4+0.6*0.85
def stats(alive):
    L={d:q*sum(e['c'] for e in alive if e['d']==d) for d in DEPTS}
    R=R0
    for d in DEPTS:
        if ALPHA[d]>0: R*=(L[d]/L0[d])**ALPHA[d]
    pay=sum(e['w'] for e in alive); oh=100+0.045*len(alive)
    return R-pay-oh,R,L
alive=list(emps); best=(stats(alive)[0],len(alive))
print("start profit %.1f H=%d"%(best[0],len(alive)))
while len(alive)>100:
    pi,R,L=stats(alive)
    # remove the employee with best net
    cand=max(alive,key=lambda e:e['w']-(ALPHA[e['d']]*R*e['c']*q/L[e['d']] if ALPHA[e['d']]>0 else 0))
    alive.remove(cand)
    p=stats(alive)[0]
    if p>best[0]: best=(p,len(alive))
print("optimum profit %.1f at H=%d (no automation, M=0.85)"%best)
print("profit at H=%d (greedy-cut path, no automation): %.1f"%(len(alive),stats(alive)[0]))
