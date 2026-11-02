/** Location and photographer verified against each original Unsplash photo page. */
export const landscapes = [
  {id:'harbour',category:'city',label:'维港夜景',kind:'夜景 / CITY LIGHTS',title:'Victoria Harbour.',name:'维多利亚港夜色',location:'中国 · 香港',description:'两岸灯火倒映在水面，暖色云层下，维港亮成一片流动的星光。',author:'Henry Lai',source:'https://unsplash.com/photos/PM8uNu5RTIw',position:'64% 60%'},
  {id:'forest',category:'nature',label:'竹林',kind:'森林 / FOREST',title:'Arashiyama.',name:'岚山竹林',location:'日本 · 京都',description:'仰望交错的竹梢，让一整片绿色把天空轻轻合拢。',author:'Eleonora Albasi',source:'https://unsplash.com/photos/fSAyrw46Tx4',position:'50% 50%'},
  {id:'beach',category:'nature',label:'海岛',kind:'海岛 / ISLAND',title:'La Digue.',name:'拉迪格岛',location:'塞舌尔 · 印度洋',description:'浅海、花岗岩与热带绿意，围出印度洋上的一座小岛。',author:'Christoph Geisler',source:'https://unsplash.com/photos/se4Xg5h-XgI',position:'50% 50%'},
  {id:'rice',category:'nature',label:'稻田',kind:'稻田 / RICE TERRACES',title:'Jatiluwih.',name:'贾蒂卢维梯田',location:'印度尼西亚 · 巴厘岛',description:'层层稻田沿山坡舒展，远山与棕榈树落在同一片晨光里。',author:'Armand Mckenzie',source:'https://unsplash.com/photos/oR9jNPOKlU8',position:'50% 28%'},
  {id:'city',category:'city',label:'夜景',kind:'夜景 / AFTER DARK',title:'Shinjuku.',name:'新宿霓虹街巷',location:'日本 · 东京',description:'雨夜的霓虹映在街面上，新宿把城市的另一面照亮。',author:'Marek Okon',source:'https://unsplash.com/photos/2m6wr8qMiio',position:'50% 70%'},
  {id:'sculpture',category:'city',label:'雕塑',kind:'雕塑 / LANDMARK',title:'Merlion.',name:'鱼尾狮公园',location:'新加坡 · 滨海湾',description:'狮首鱼身的雕像向海湾吐水，身后是新加坡的城市天际线。',author:'Zhu Hongzhi',source:'https://unsplash.com/photos/EtjLtPUbqbs',position:'50% 10%'}
];
export const photoPath = (place, small = false) => `/assets/places/${place.id}${small ? '.thumb' : ''}.jpg`;
