from PIL import Image;import numpy as np;from scipy import ndimage;import os,json
im=Image.open('tropical_furniture.png').convert('RGBA');A=np.array(im);a=A[:,:,3]>16
B={'bed':(22,27,342,348),'couch':(365,30,670,342),'desk':(693,57,945,333),'kitchen':(998,22,1305,360),'plant':(1342,67,1518,338),
'lamp':(37,393,158,690),'console':(202,387,498,705),'cafe':(532,360,870,720),'arcade':(915,412,1092,705),'garden':(1143,393,1530,720),
'booth':(195,742,518,998),'schooldesk':(607,772,818,960),'shelf':(960,720,1185,998)}
lab,n=ndimage.label(ndimage.binary_dilation(a,iterations=2))
cm=ndimage.center_of_mass(a,lab,range(1,n+1));sz=ndimage.sum(a,lab,range(1,n+1))
OUT='iso_wt/assets/furniture';meta={};tot=0
for k,(x0,y0,x1,y1) in B.items():
  keep=np.zeros_like(a)
  for i,(cy,cx) in enumerate(cm):
    if sz[i]>20 and x0<=cx<=x1 and y0<=cy<=y1: keep|=lab==i+1
  keep&=a; ys,xs=np.where(keep)
  bx0,by0,bx1,by1=xs.min(),ys.min(),xs.max()+1,ys.max()+1
  C=A[by0:by1,bx0:bx1].copy();C[:,:,3]=np.where(keep[by0:by1,bx0:bx1],C[:,:,3],0)
  img=Image.fromarray(C);W=160 if k not in('lamp','plant') else 110
  s=W/img.width;img=img.resize((W,max(1,round(img.height*s))),Image.LANCZOS)
  q=img.quantize(colors=96,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE)
  p=f'{OUT}/{k}.png';q.save(p,optimize=True);meta[k]=[img.width,img.height];tot+=os.path.getsize(p)
  print(k,img.size,os.path.getsize(p))
json.dump(meta,open(f'{OUT}/sizes.json','w'));print('total',tot)
