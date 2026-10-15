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
def save(name,img,W):
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
