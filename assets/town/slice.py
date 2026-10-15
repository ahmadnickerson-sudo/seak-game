# usage (from /workspace/seak): python3 iso_wt/assets/town/slice.py
from PIL import Image;import numpy as np;from scipy import ndimage;import os,json
OUT='iso_wt/assets/town';meta={}
def comps(path):
  A=np.array(Image.open(path).convert('RGBA'));a=A[:,:,3]>16
  lab,n=ndimage.label(ndimage.binary_dilation(a,iterations=4))
  sl=ndimage.find_objects(lab);res=[]
  for i,s in enumerate(sl):
    m=(lab==i+1)&a
    if m.sum()<1500: continue
    ys,xs=np.where(m);x0,y0,x1,y1=xs.min(),ys.min(),xs.max()+1,ys.max()+1
    C=A[y0:y1,x0:x1].copy();C[:,:,3]=np.where(m[y0:y1,x0:x1],C[:,:,3],0)
    res.append(((x0,y0),Image.fromarray(C)))
  return res
def untree(img):
  # strip the baked-in grass diamond (grass, flowers, rocks) under the tree; keep trunk + soft contact shadow
  A=np.array(img);h,w=A.shape[:2];R,G,B=[A[:,:,i].astype(int) for i in range(3)];al=A[:,:,3]>16
  brown=al&(R>G+8)&(R>B+25)&(R<235)
  rows=np.where(brown.sum(1)>0)[0];lo=int(h*.62)
  cx=int(np.median(np.where(brown[lo:int(h*.74)])[1]))   # trunk centre x
  # canopy bottom: last row (above trunk) where wide green still present
  trunkband=np.zeros_like(al);trunkband[:,max(0,cx-int(w*.12)):cx+int(w*.12)]=True
  keep=al&brown&trunkband
  start=int(h*.70);out=A.copy()
  out[start:,:,3]=np.where(keep[start:],A[start:,:,3],0)
  lab,n=ndimage.label(out[:,:,3]>16)   # drop stray specks (rocks, petals) not attached to the tree
  if n>1:
    big=np.argmax(ndimage.sum(np.ones_like(lab),lab,range(1,n+1)))+1;out[:,:,3]=np.where(lab==big,out[:,:,3],0)
  keep=keep&(out[:,:,3]>16)
  # trunk base row = lowest kept brown row; shadow ellipse right under it
  ys=np.where(keep[start:].any(1))[0]+start;yb=int(ys.max())
  yy,xx=np.mgrid[0:h,0:w];rx,ry=w*.20,w*.075;cy=yb-ry*.55
  d=((xx-cx)/rx)**2+((yy-cy)/ry)**2;sh=np.clip(1-d,0,1)**1.2*95
  sh=np.where(yy>=start-4,sh,0)
  base=out[:,:,3].astype(float);new=np.maximum(base,sh)
  # shadow pixels (where no sprite) are dark green-black, translucent
  m=(base<sh)
  out[m,0]=20;out[m,1]=40;out[m,2]=25;out[:,:,3]=new.astype(np.uint8)
  return Image.fromarray(out)
def save(name,img,W):
  if name.startswith('tree'):img=untree(img)
  s=W/img.width;img=img.resize((W,max(1,round(img.height*s))),Image.LANCZOS)
  img.save(f'{OUT}/{name}.png',optimize=True);meta[name]=[img.width,img.height]
c1=comps('town_art_sheet.png');print([(p,i.size) for p,i in c1])
top=sorted([c for c in c1 if c[0][1]<350 or c[1].height>250],key=lambda c:c[0][0])
bot=sorted([c for c in c1 if c not in top],key=lambda c:c[0][0])
save('fountain',top[0][1],300)
for k in range(3):save(f'tree{k+1}',top[k+1][1],160)
for k in range(4):save(f'brick{k+1}',bot[k][1],96)
for k in range(2):save(f'grass{k+1}',bot[4+k][1],96)
c2=sorted(comps('town_grass2.png'),key=lambda c:c[0][0])
for k in range(2):save(f'grass{k+3}',c2[k][1],96)
json.dump(meta,open(f'{OUT}/sizes.json','w'));print(meta)
