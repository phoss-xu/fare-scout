# 目的地照片选片记录

2026-11-04 第二轮选片。7 张实拍照片供 8 个机场入口使用，东京羽田与成田共用东京城市照片。全部先查看原图，再检查卡片裁切；没有 AI 补画或改变原图内容。资源由 Unsplash CDN 缩放为 1600px JPEG。

选片方向：主体易辨认、光线清楚、构图简洁。高雄阴天龙虎塔和河内枝叶遮挡严重的近景候选已弃用。东京保留蓝调时刻的城市远景，避免街景广告与拥挤招牌。

| 入口 | 主体 | 摄影师 | 原图 / 许可 |
| --- | --- | --- | --- |
| DAD | 巴拿山金桥 | Ivan Wong | [原图](https://unsplash.com/photos/a-bridge-that-has-people-walking-across-it-m3E0S4LoIuQ) · [Unsplash License](https://unsplash.com/license) |
| KHH | 高雄港与流行音乐中心 | Steve Matthews | [原图](https://unsplash.com/photos/city-skyline-and-port-on-a-sunny-day-jick8fCI3bc) · [Unsplash License](https://unsplash.com/license) |
| HAN | 还剑湖栖旭桥 | Dat | [原图](https://unsplash.com/photos/red-bridge-over-a-lake-with-lush-trees-TXk5ne-Iv54) · [Unsplash License](https://unsplash.com/license) |
| HKG | 太平山维港远景 | Aonghus Heatley | [原图](https://unsplash.com/photos/city-skyline-under-blue-sky-during-daytime-fA9JETEkWZA) · [Unsplash License](https://unsplash.com/license) |
| SIN | 滨海湾金沙 | Kirill Petropavlov | [原图](https://unsplash.com/photos/marina-bay-sands-hotel-during-daytime-vmGwPt9gpV0) · [Unsplash License](https://unsplash.com/license) |
| HND | 东京塔与城市天际线 | Louie Martinez | [原图](https://unsplash.com/photos/tokyo-tower-illuminated-at-dusk-with-city-skyline-IocJwyqRv3M) · [Unsplash License](https://unsplash.com/license) |
| NRT | 东京塔与城市天际线 | Louie Martinez | [原图](https://unsplash.com/photos/tokyo-tower-illuminated-at-dusk-with-city-skyline-IocJwyqRv3M) · [Unsplash License](https://unsplash.com/license) |
| DPS | 乌伦达努布拉坦水神庙 | Santhosh Mocharla | [原图](https://unsplash.com/photos/pura-ulun-danu-bratan-temple-on-lake-bratan-bali-tMkp36b1qRk) · [Unsplash License](https://unsplash.com/license) |

`destination-photos.json` 保存文件、作者、许可与 CDN 标识；`scripts/update_destination_photos.py` 按现有目录恢复同一组图片，不再覆盖成早期缩略图。

`destination-photos.css` 负责卡片、登机牌的图像高度、渐变和逐图焦点，字体继续引用全局 `--family`。默认 object-fit: cover；裁切会因容器比例不同保留不同范围，并非保证展示完整原图。

## 2026-11-04 · 全球热门扩充

新增 18 座城市，共 25 个目的地、26 条目录记录。全部下载 1600px 原图并查看；同城机场按目录关系复用，不按城市名称猜测。原图均使用 Unsplash License，来源、原始 CDN 标识、尺寸、主体、机场入口与裁切焦点保存于 `destination-photos.json`。

| 城市 | 主体 | 作者 | 来源 |
| --- | --- | --- | --- |
| Bangkok | 郑王庙与湄南河 | Kelvin Zyteng | [原图](https://unsplash.com/photos/wat-arun-temple-in-bangkok-H3pF3zZMiAQ) · [许可](https://unsplash.com/license) |
| Kuala Lumpur | 吉隆坡双子塔城市日落 | Igor Savelev | [原图](https://unsplash.com/photos/a-view-of-a-city-from-a-high-rise-vH9z9d6Mbd8) · [许可](https://unsplash.com/license) |
| Phuket | 普吉岛香蕉海滩 | Max Bvp | [原图](https://unsplash.com/photos/a-view-of-a-beach-with-rocks-and-water-EDVQf-1rvjs) · [许可](https://unsplash.com/license) |
| Chiang Mai | 因他农山佛塔与花园 | Daniele Franchi | [原图](https://unsplash.com/photos/a-temple-stands-tall-under-the-clear-blue-sky-RitltvaisCs) · [许可](https://unsplash.com/license) |
| Penang | 槟城极乐寺 | Job Savelsberg | [原图](https://unsplash.com/photos/a-view-of-a-city-from-a-high-point-of-view-UsQGu7J24t0) · [许可](https://unsplash.com/license) |
| Manila | 马尼拉城市天际线 | Alexes Gerard | [原图](https://unsplash.com/photos/city-skyline-under-blue-sky-during-daytime-vL2h7xYiIlk) · [许可](https://unsplash.com/license) |
| Ho Chi Minh City | 西贡河与城市日落 | Thompson Le | [原图](https://unsplash.com/photos/city-skyline-at-sunset-over-calm-water-22gb4pvvLmo) · [许可](https://unsplash.com/license) |
| Osaka | 大阪城 | Michael Geyer | [原图](https://unsplash.com/photos/osaka-castle-with-a-clear-blue-sky-3z2oLW2wSFk) · [许可](https://unsplash.com/license) |
| Taipei | 台北101与城市夜景 | Timo Volz | [原图](https://unsplash.com/photos/city-skyline-during-night-time-phjpsNFw6pM) · [许可](https://unsplash.com/license) |
| Macau | 澳门夜景与跨海大桥 | Yuxin Chen | [原图](https://unsplash.com/photos/a-city-skyline-at-night-with-a-bridge-going-across-it-598Ah85XPiY) · [许可](https://unsplash.com/license) |
| Seoul | 景福宫兴礼门 | Raymond Yeung | [原图](https://unsplash.com/photos/a-tall-building-with-a-sky-in-the-background-e9OxvjF1lD0) · [许可](https://unsplash.com/license) |
| London | 伦敦塔桥 | Polina Sushko | [原图](https://unsplash.com/photos/tower-bridge-in-london-RCLO9vhMqxM) · [许可](https://unsplash.com/license) |
| Paris | 巴黎埃菲尔铁塔与塞纳河 | Mael GOUYET | [原图](https://unsplash.com/photos/the-eiffel-tower-towering-over-the-city-of-paris-ihsG8r25yZg) · [许可](https://unsplash.com/license) |
| Rome | 罗马斗兽场外观 | Mathew Schwartz | [原图](https://unsplash.com/photos/coliseum-italy-s87bBFZviAU) · [许可](https://unsplash.com/license) |
| Sydney | 悉尼歌剧院与港湾 | Huy Q. Tran | [原图](https://unsplash.com/photos/sydney-opera-house-and-harbour-on-a-sunny-day-AKfcTVBAjys) · [许可](https://unsplash.com/license) |
| New York | 曼哈顿天际线与东河 | Peter Beke | [原图](https://unsplash.com/photos/manhattan-skyline-in-new-york-city-THfNPmgVC08) · [许可](https://unsplash.com/license) |
| Los Angeles | 洛杉矶城市远景 | Bobby Thapa | [原图](https://unsplash.com/photos/los-angeles-skyline-and-residential-sprawl-RVIVcZT8Qms) · [许可](https://unsplash.com/license) |
| Dubai | 迪拜哈利法塔夜景 | Ansub Khan | [原图](https://unsplash.com/photos/dubai-city-skyline-illuminated-at-night-with-burj-khalifa-zCYVd3IN6l8) · [许可](https://unsplash.com/license) |

选片中淘汰了主体前有游客人群的罗马斗兽场、被树木和街边汽车遮挡的悉尼歌剧院、留白过多的大阪城、偏暗且主体很小的台北河景及首尔游客合影。没有对实拍内容补画或改变，只做源 CDN 缩放和 CSS 裁切。

## 2026-11-04 · 内地、东亚与实际报价目的地补齐

本批新增 19 个目的地，累计 44 个。先补齐历史报价回放中缺图的 7 个地点，再覆盖全部内地与东亚热门城市。选片拒绝了高度仅 297px 的长沙超宽全景、釜山含施工棚的寺庙画面、天坛主体遮挡的备选；广州改用横向珠江天际线，以适应卡片和宽票面。

| 城市 | 主体 | 作者 | 来源 |
| --- | --- | --- | --- |
| Kota Kinabalu | 亚庇水上清真寺 | Andy Wang | [原图](https://unsplash.com/photos/landscape-of-a-mosque-sy8qhu0nngY) · [许可](https://unsplash.com/license) |
| Phu Quoc | 富国岛白沙滩 | Vivu Vietnam | [原图](https://unsplash.com/photos/a-beach-with-palm-trees-and-a-white-sand-beach-r6CIzamxaek) · [许可](https://unsplash.com/license) |
| Hangzhou | 杭州西湖亭桥 | Kounotori | [原图](https://unsplash.com/photos/traditional-pavilion-on-a-bridge-over-water-MsEHSLU2Kjg) · [许可](https://unsplash.com/license) |
| Jeju | 济州城山日出峰 | Jake Mullins | [原图](https://unsplash.com/photos/green-volcanic-crater-towering-over-the-ocean-and-rocky-shore-4VAaVN35FQo) · [许可](https://unsplash.com/license) |
| Guangzhou | 广州珠江与天河天际线 | Wally Yang | [原图](https://unsplash.com/photos/city-skyline-under-blue-sky-during-daytime-pcqQtzv1jEU) · [许可](https://unsplash.com/license) |
| Clark | 克拉克周边 · 皮纳图博火山湖 | Sharmaine Monticalbo | [原图](https://unsplash.com/photos/a-large-body-of-water-surrounded-by-mountains-8a10JXgm0gs) · [许可](https://unsplash.com/license) |
| Sanya | 三亚凤凰岛与帆船 | krzhck | [原图](https://unsplash.com/photos/a-couple-of-boats-that-are-in-the-water-nSt5JSHh1uA) · [许可](https://unsplash.com/license) |
| Shanghai | 上海外滩与陆家嘴天际线 | Rich Xu | [原图](https://unsplash.com/photos/shanghai-skyline-reflected-in-huangpu-river-at-dusk-O1wp75o24tE) · [许可](https://unsplash.com/license) |
| Beijing | 北京天坛祈年殿 | Macarena Ollarzú | [原图](https://unsplash.com/photos/the-temple-of-heaven-in-beijing-with-many-visitors-ZZgVtMff1Gk) · [许可](https://unsplash.com/license) |
| Shenzhen | 深圳湾城市夜景 | Jason Yuen | [原图](https://unsplash.com/photos/a-city-skyline-at-night-I1qQT5R8kTk) · [许可](https://unsplash.com/license) |
| Chengdu | 成都安顺廊桥 | phatthanan tuppocha | [原图](https://unsplash.com/photos/illuminated-bridge-at-night-reflecting-in-the-water-zvhhsB_s9iA) · [许可](https://unsplash.com/license) |
| Chongqing | 重庆桥梁与山城夜色 | Spencer Liao | [原图](https://unsplash.com/photos/dongshuimen-bridge-at-night-in-chongqing-4kxgKMzBjwc) · [许可](https://unsplash.com/license) |
| Xian | 西安城墙日落 | Aoyu Zhang | [原图](https://unsplash.com/photos/illuminated-ancient-chinese-city-wall-and-tower-at-sunset-KNpElyP6R20) · [许可](https://unsplash.com/license) |
| Kunming | 昆明西山俯瞰滇池 | Quan Jing | [原图](https://unsplash.com/photos/a-large-body-of-water-surrounded-by-a-city-fLM4EqfAppc) · [许可](https://unsplash.com/license) |
| Xiamen | 厦门鼓浪屿与海岸 | Letian Zhang | [原图](https://unsplash.com/photos/a-view-of-a-city-and-a-body-of-water-XjHNLadzEjY) · [许可](https://unsplash.com/license) |
| Qingdao | 青岛海岸城市远景 | Squids Z | [原图](https://unsplash.com/photos/city-skyline-viewed-from-across-the-water-ka-Hc3Yzb7U) · [许可](https://unsplash.com/license) |
| Wuhan | 武汉黄鹤楼 | Bo Zhang | [原图](https://unsplash.com/photos/a-tall-building-with-a-yellow-roof-surrounded-by-trees-C2z6-TWsooU) · [许可](https://unsplash.com/license) |
| Changsha | 长沙湘江桥梁与城市夜景 | Steven Lynn | [原图](https://unsplash.com/photos/cityscape-with-lit-bridge-and-skyscrapers-at-dusk-12GO8E5vPck) · [许可](https://unsplash.com/license) |
| Busan | 釜山甘川文化村 | Jimmy Moon | [原图](https://unsplash.com/photos/assorted-color-houses-during-day-time-KpIgjFZmp0E) · [许可](https://unsplash.com/license) |

克拉克使用周边皮纳图博火山湖实拍，不标为克拉克市区；[菲律宾旅游介绍](https://philippines.travel/spots/mt-pinatubo/index)列出 Angeles/Clark 为这一景点的出行落脚地。照片拍摄地 Botolan/Zambales 由原图页记录，相关说明也保存在照片元数据。

## 欧洲与北美扩充（2026-11-04）

逐张核对来源与地点；排除低于 800px 高度的温哥华全景，以及主体不适合卡片裁切的候选。原始 JPEG 保留，无额外修图。

| 城市 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Amsterdam | 阿姆斯特丹运河与山墙屋 | Tobias Reich | [原图](https://unsplash.com/photos/canal-houses-and-boats-in-amsterdam-on-a-sunny-day-xnXlsdPs1aI) · [许可](https://unsplash.com/license) |
| Zurich | 苏黎世利马特河与老城 | Henrique Ferreira | [原图](https://unsplash.com/photos/a-river-running-through-a-city-surrounded-by-tall-buildings-omiTbS-nb_M) · [许可](https://unsplash.com/license) |
| Prague | 布拉格查理大桥晨光 | Lukáš Konvica | [原图](https://unsplash.com/photos/a-river-with-a-bridge-and-buildings-in-the-background-6viOy4pJa2k) · [许可](https://unsplash.com/license) |
| Barcelona | 巴塞罗那城市全景与地中海 | B dim | [原图](https://unsplash.com/photos/barcelona-cityscape-with-sagrada-familia-Qzm0uB6BCHs) · [许可](https://unsplash.com/license) |
| San Francisco | 旧金山金门大桥与海岸 | Michael Baccin | [原图](https://unsplash.com/photos/golden-gate-bridge-in-san-francisco-fFeUlum1tJ8) · [许可](https://unsplash.com/license) |
| Toronto | 多伦多湖滨与加拿大国家电视塔 | Joshua Jumarie | [原图](https://unsplash.com/photos/toronto-skyline-with-cn-tower-and-waterfront-nZ73tLbskdY) · [许可](https://unsplash.com/license) |
| Montreal | 蒙特利尔旧港 | Fenil Patel | [原图](https://unsplash.com/photos/a-view-of-a-city-skyline-from-a-pier-_xVFdnYTIao) · [许可](https://unsplash.com/license) |
| Mexico City | 墨西哥城艺术宫 | Samuel Reyes | [原图](https://unsplash.com/photos/people-walking-near-palacio-de-bellas-artes-in-mexico-city-under-white-and-blue-sky-during-daytime-cBUNvxfMShI) · [许可](https://unsplash.com/license) |
| Munich | 慕尼黑老城与红瓦屋顶 | kwan fung | [原图](https://unsplash.com/photos/high-angle-photography-of-city-buildings-TX7bW0cJG8A) · [许可](https://unsplash.com/license) |
| Vienna | 维也纳美泉宫 | jens schwan | [原图](https://unsplash.com/photos/schonbrunn-palace-in-vienna-under-a-clear-blue-sky-QVgy6ytNr9c) · [许可](https://unsplash.com/license) |
| Frankfurt | 法兰克福美因河城市全景 | Bernd 📷 Dittrich | [原图](https://unsplash.com/photos/city-skyline-with-modern-skyscrapers-and-river-under-dramatic-clouds-InT_P0S9_1w) · [许可](https://unsplash.com/license) |
| Vancouver | 温哥华天际线与北岸群山 | Luke Lawreszuk | [原图](https://unsplash.com/photos/a-view-of-a-city-with-mountains-in-the-background-rEDvog99iro) · [许可](https://unsplash.com/license) |

## 大洋洲与中东扩充（2026-11-04）

| 城市 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Auckland | 奥克兰海港与天空塔暮色 | Arno Retief | [原图](https://unsplash.com/photos/a-large-body-of-water-with-a-city-in-the-background-skNuvHtFC_4) · [许可](https://unsplash.com/license) |
| Brisbane | 布里斯班河与城市夕照 | Queensland, Australia | [原图](https://unsplash.com/photos/brisbane-skyline-and-river-at-sunset-Y6yDS-LoK6s) · [许可](https://unsplash.com/license) |
| Melbourne | 墨尔本弗林德斯街车站 | Fabio Cagni | [原图](https://unsplash.com/photos/flinders-street-station-stands-tall-in-melbourne-_gfGS2ywGx8) · [许可](https://unsplash.com/license) |
| Perth | 珀斯天鹅河日出 | Eddie Mark Blair | [原图](https://unsplash.com/photos/a-city-skyline-at-night-XU3sz-IJANk) · [许可](https://unsplash.com/license) |
| Abu Dhabi | 阿布扎比谢赫扎耶德大清真寺 | Nick Fewings | [原图](https://unsplash.com/photos/a-mosque-dome-is-seen-through-an-archway-e-piepTXxx4) · [许可](https://unsplash.com/license) |
| Doha | 多哈西湾天际线 | Kenny | [原图](https://unsplash.com/photos/a-group-of-tall-buildings-in-a-city-rsMfEFFrgqc) · [许可](https://unsplash.com/license) |
| Istanbul | 伊斯坦布尔清真寺与渡船 | Alexandra | [原图](https://unsplash.com/photos/istanbuls-skyline-features-mosques-boats-and-the-water-OmlS__oGANs) · [许可](https://unsplash.com/license) |

## 南美与非洲扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Rio de Janeiro | 里约热内卢基督像与海湾 | Raphael Nogueira | [原图](https://unsplash.com/photos/christ-the-redeemer-brazil-OkiDIla7K8Q) · [许可](https://unsplash.com/license) |
| Buenos Aires | 布宜诺斯艾利斯方尖碑与七月九日大道 | Nestor Barbitta | [原图](https://unsplash.com/photos/obelisco-de-buenos-aires-and-avenue-QhQ4WgX77G0) · [许可](https://unsplash.com/license) |
| Lima | 利马米拉弗洛雷斯海岸 | Willian Justen de Vasconcellos | [原图](https://unsplash.com/photos/road-near-body-of-water-and-buildings-at-daytime-mZKEIRBStv4) · [许可](https://unsplash.com/license) |
| Bogota | 波哥大坎德拉里亚老城街景 | Aniket Das | [原图](https://unsplash.com/photos/a-street-with-buildings-on-both-sides-G0pfvtnmPvA) · [许可](https://unsplash.com/license) |
| Santiago | 圣地亚哥城市与安第斯山 | Nikolai Kolosov | [原图](https://unsplash.com/photos/city-skyline-with-mountains-in-the-background-at-sunset-Wz_9eBkNF8U) · [许可](https://unsplash.com/license) |
| Sao Paulo | 圣保罗城市夕照 | Filipe Freitas | [原图](https://unsplash.com/photos/a-view-of-a-city-from-a-distance-rm9uMJP8o18) · [许可](https://unsplash.com/license) |
| Cape Town | 开普敦维多利亚码头与桌山 | Marlin Clark | [原图](https://unsplash.com/photos/a-group-of-boats-are-docked-in-a-harbor-sALNB8x7hNM) · [许可](https://unsplash.com/license) |
| Cairo | 开罗周边吉萨金字塔 | Shashi Ghosh | [原图](https://unsplash.com/photos/two-egyptian-pyramids-under-a-clear-blue-sky-pIhJ3BzBMQA) · [许可](https://unsplash.com/license) |
| Mauritius | 毛里求斯莫纳地区海岸 | Stephan van de Schootbrugge | [原图](https://unsplash.com/photos/an-aerial-view-of-a-beach-and-a-body-of-water-y2PaGvkMek4) · [许可](https://unsplash.com/license) |
| Johannesburg | 约翰内斯堡天际线暮色 | Thomas Bennie | [原图](https://unsplash.com/photos/city-skyline-under-cloudy-sky-during-night-time-kws8dJ9wfwc) · [许可](https://unsplash.com/license) |
| Nairobi | 内罗毕城市与绿地 | imsogabriel stock | [原图](https://unsplash.com/photos/a-cityscape-of-nairobi-kenya-on-a-sunny-day-IaJm3mq0F5o) · [许可](https://unsplash.com/license) |

开罗照片为吉萨金字塔群，并非开罗市区街景；毛里求斯照片为莫纳地区海岸，不标为首都路易港。机场入口按当地出行范围复用，未把同国其他城市借作照片。

## 南亚扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Kathmandu | 加德满都博达哈大佛塔 | Meghraj Neupane | [原图](https://unsplash.com/photos/white-and-gold-concrete-building-under-blue-sky-during-daytime-YtEzq-hnv5k) · [许可](https://unsplash.com/license) |
| New Delhi | 新德里印度门与草坪 | priyanshu shankhdhar | [原图](https://unsplash.com/photos/india-gate-monument-in-new-delhi-szx7jO2sKHQ) · [许可](https://unsplash.com/license) |
| Mumbai | 孟买泰姬陵宫酒店暮色 | Chaitali Debashish | [原图](https://unsplash.com/photos/the-taj-mahal-palace-hotel-is-lit-up-at-dusk-QDFchqL0Ezw) · [许可](https://unsplash.com/license) |
| Male | 马累胡鲁马累岛海岸与游船 | Ahmed Saalim Hussain | [原图](https://unsplash.com/photos/an-aerial-view-of-a-boat-in-a-body-of-water-tr5CKHaMRGE) · [许可](https://unsplash.com/license) |
| Colombo | 科伦坡莲花塔 | Tharoushan Kandarajah | [原图](https://unsplash.com/photos/train-and-lotus-tower-in-colombo-KtDXt7DyfVM) · [许可](https://unsplash.com/license) |
| Jaipur | 斋浦尔风之宫 | Katakam Devayani | [原图](https://unsplash.com/photos/hawa-mahal-palace-facade-in-jaipur-RQCbgdmuSgo) · [许可](https://unsplash.com/license) |
| Goa | 南果阿海滩与棕榈树 | Ishvani Hans | [原图](https://unsplash.com/photos/a-sandy-beach-next-to-the-ocean-with-palm-trees-xWFL4KNd_2A) · [许可](https://unsplash.com/license) |
| Bengaluru | 班加罗尔议会大厦 | Mahadev Ittina | [原图](https://unsplash.com/photos/a-view-of-a-city-from-the-top-of-a-hill-vJ94Yh36524) · [许可](https://unsplash.com/license) |

马累照片拍于胡鲁马累岛，未将远处独立环礁或度假岛标为马累市区。果阿为地区目的地，照片明确为南果阿 Quepem 海岸，GOI/GOX 共用当地旅行风景。

## 欧洲首都扩充（2026-11-04）

| 城市 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Athens | 雅典帕特农神庙立柱 | Magnus Engø | [原图](https://unsplash.com/photos/acropolis-in-athens-greece-kLT5Lne_ESk) · [许可](https://unsplash.com/license) |
| Lisbon | 里斯本红瓦屋顶与夕照 | Farnaz Kohankhaki | [原图](https://unsplash.com/photos/cityscape-bathed-in-warm-golden-hour-sunlight-5nhEmBI5uM0) · [许可](https://unsplash.com/license) |
| Berlin | 柏林勃兰登堡门 | Julia Taubitz | [原图](https://unsplash.com/photos/people-gather-in-front-of-the-brandenburg-gate-berlin-99Jg7NW2bGs) · [许可](https://unsplash.com/license) |
| Madrid | 马德里王宫 | Bo Zhang | [原图](https://unsplash.com/photos/a-large-building-with-a-clock-tower-on-top-of-it-q55Zp-PAsg4) · [许可](https://unsplash.com/license) |
| Copenhagen | 哥本哈根新港彩色房屋与船舶 | Denis | [原图](https://unsplash.com/photos/a-row-of-buildings-next-to-a-body-of-water-YCViuZ3BoLY) · [许可](https://unsplash.com/license) |
| Stockholm | 斯德哥尔摩老城滨水全景 | Chris Caines | [原图](https://unsplash.com/photos/a-body-of-water-with-buildings-along-it-3hxrVgr1ZL0) · [许可](https://unsplash.com/license) |
| Oslo | 奥斯陆歌剧院与海港 | Eirik Skarstein | [原图](https://unsplash.com/photos/a-building-that-is-next-to-a-body-of-water-1xchyilgsnM) · [许可](https://unsplash.com/license) |
| Helsinki | 赫尔辛基大教堂 | Denis | [原图](https://unsplash.com/photos/a-large-white-building-with-a-green-dome-8c2GCjNF3PE) · [许可](https://unsplash.com/license) |

## 东南亚海岛与文化目的地扩充（2026-11-04）

| 目的地入口 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| CEB · Cebu City | 宿务 CCLEX 海湾大桥夜景 | Ken Suarez | [原图](https://unsplash.com/photos/illuminated-cable-stayed-bridge-over-water-at-night-WwqHVAHv87c) · [许可](https://unsplash.com/license) |
| MPH · Caticlan | 长滩岛白沙滩帆船与夕照 | Ramon Kagie | [原图](https://unsplash.com/photos/white-boat-docked-on-seashore-4EZKcKxOlRE) · [许可](https://unsplash.com/license) |
| PPS · Puerto Princesa | 普林塞萨港地下河入口 | Elaine Ore | [原图](https://unsplash.com/photos/a-group-of-people-in-a-boat-in-a-body-of-water-by-a-cliff-with-puerto-princesa-subterranean-river-national-park-in-the-background-YsNgfJwUpxQ) · [许可](https://unsplash.com/license) |
| SAI · Siem Reap | 暹粒吴哥窟日出 | Niels Baars | [原图](https://unsplash.com/photos/angkor-wat-temple-complex-at-sunrise-with-reflection-ridd77X1G6Y) · [许可](https://unsplash.com/license) |
| LPQ · Luang Prabang | 琅勃拉邦香通寺 | Hongbin | [原图](https://unsplash.com/photos/a-row-of-buildings-sitting-next-to-each-other-t7mSUQcTPsY) · [许可](https://unsplash.com/license) |
| RGN · Yangon | 仰光大金塔建筑群 | Sacha Gregoire | [原图](https://unsplash.com/photos/gold-and-red-temple-under-white-clouds-during-daytime-UBF-Zhd3Mmo) · [许可](https://unsplash.com/license) |
| LOP · Praya | 龙目岛海岸航拍 | Simon PALLARD | [原图](https://unsplash.com/photos/an-aerial-view-of-a-beach-and-ocean-etQHL6iXIXo) · [许可](https://unsplash.com/license) |
| JOG · Yogyakarta | 日惹普兰巴南神庙群 | Rowan Heuvel | [原图](https://unsplash.com/photos/ancient-stone-temples-under-a-cloudy-sky-2tq8Xg0eXfE) · [许可](https://unsplash.com/license) |

MPH 使用邻近长滩岛白沙滩实拍，原图明确 Boracay/Malay；[长滩岛旅游入口说明](https://visitboracay.ph/getting-to-boracay)列出卡提克兰机场。LOP 使用龙目岛海岸实拍，明确非普拉亚市区；SAI 依据地点目录对应暹粒。

## 北美城市扩充（2026-11-04）

| 城市 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Chicago | 芝加哥河与城市夜景 | Gael D | [原图](https://unsplash.com/photos/a-city-skyline-at-night-with-a-river-running-through-it-TZ4ZRa3yJqM) · [许可](https://unsplash.com/license) |
| Las Vegas | 拉斯维加斯大道夜景 | Wesley Tingey | [原图](https://unsplash.com/photos/a-view-of-the-las-vegas-strip-at-night-P9pfH4RYuiE) · [许可](https://unsplash.com/license) |
| Seattle | 西雅图天际线与太空针塔 | Josh Hild | [原图](https://unsplash.com/photos/a-view-of-the-seattle-skyline-from-the-space-needle-MgX_c1HFf8I) · [许可](https://unsplash.com/license) |
| Honolulu | 檀香山威基基海岸航拍 | Austin Schmid | [原图](https://unsplash.com/photos/an-aerial-view-of-the-city-of-honolulu-0KteUt3Dah0) · [许可](https://unsplash.com/license) |
| Boston | 波士顿查尔斯河与城市夜景 | Wenhao Ruan | [原图](https://unsplash.com/photos/a-city-skyline-at-night-SSAYHnAoDLc) · [许可](https://unsplash.com/license) |
| Washington DC | 华盛顿潮汐湖樱花 | Jeffrey Clayton | [原图](https://unsplash.com/photos/a-beautiful-view-of-the-washington-monument-and-cherry-blossoms-8Pfk-VUU40Q) · [许可](https://unsplash.com/license) |
| Calgary | 卡尔加里河湾与城市夕照 | Zach Heiberg | [原图](https://unsplash.com/photos/a-city-skyline-with-a-river-running-through-it-ZJVL2rQmsV8) · [许可](https://unsplash.com/license) |
| Ottawa | 渥太华国会山 | Benoit Debaix | [原图](https://unsplash.com/photos/brown-concrete-building-under-cloudy-sky-during-daytime-ReUoz0CwfGo) · [许可](https://unsplash.com/license) |

波士顿照片从剑桥的查尔斯河岸拍向波士顿市区，不将对岸麻省理工校园误标为波士顿市中心。华盛顿照片明确为潮汐湖樱花及华盛顿纪念碑，非国会大厦。

## 非洲城市与海岛扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Marrakech | 马拉喀什老城广场暮色 | Val Vesa | [原图](https://unsplash.com/photos/busy-marketplace-at-dusk-with-illuminated-stalls-and-buildings-tVEaNtuRX5Y) · [许可](https://unsplash.com/license) |
| Casablanca | 卡萨布兰卡哈桑二世清真寺与海岸 | marcovitjz tirtokromo | [原图](https://unsplash.com/photos/hassan-ii-mosque-on-a-cloudy-day-by-the-ocean-r0eegWwN9tA) · [许可](https://unsplash.com/license) |
| Tunis | 突尼斯卡斯巴广场与市政厅 | Margo Evardson | [原图](https://unsplash.com/photos/grand-tunisian-building-with-national-flags-under-a-clear-sky-7Wi5p55bffQ) · [许可](https://unsplash.com/license) |
| Zanzibar | 桑给巴尔岛 Nungwi 白沙海滩 | Polly Sadler | [原图](https://unsplash.com/photos/a-white-sandy-beach-with-houses-on-it-glxZAuaYH_M) · [许可](https://unsplash.com/license) |
| Mahe Island | 塞舌尔马埃岛昂斯因滕丹斯海滩 | Davide Robetti | [原图](https://unsplash.com/photos/a-sandy-beach-with-palm-trees-and-blue-water-HWoJMR3sWgE) · [许可](https://unsplash.com/license) |
| Addis Ababa | 亚的斯亚贝巴城市天际线 | Msganaw Wogaso | [原图](https://unsplash.com/photos/city-skyline-with-scattered-clouds-on-a-bright-day-zPvSH0oRgvk) · [许可](https://unsplash.com/license) |
| Kigali | 基加利城市夕照 | Jean Claude Akarikumutima | [原图](https://unsplash.com/photos/the-sun-is-setting-over-a-city-with-tall-buildings-b-HnOOPRfTI) · [许可](https://unsplash.com/license) |
| Dar es Salaam | 达累斯萨拉姆城市夕照 | Omar | [原图](https://unsplash.com/photos/city-skyline-above-residential-rooftops-eY3z-w546TE) · [许可](https://unsplash.com/license) |

桑给巴尔使用同岛北部 Nungwi 白沙海滩实拍，非石头城市区；马埃岛照片为 Anse Intendance，非其他塞舌尔岛屿。亚的斯亚贝巴采用 1800 × 810 版本保留横向全景比例，其余本批为 1600px 宽。

## 中东、中亚与高加索扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Muscat | 马斯喀特穆特拉海湾与山景 | Sebastian S | [原图](https://unsplash.com/photos/coastal-city-with-mountains-and-a-bay-D8xm_QFVHLk) · [许可](https://unsplash.com/license) |
| Manama | 巴林麦纳麦世贸中心与天际线 | Ondrej Bocek | [原图](https://unsplash.com/photos/the-bahrain-world-trade-center-at-sunrise-wOlMEpBzwHs) · [许可](https://unsplash.com/license) |
| Amman | 安曼城堡山俯瞰城市与罗马剧场 | Hisham Zayadneh | [原图](https://unsplash.com/photos/aerial-view-of-city-buildings-during-daytime-t4yAeUQzxXY) · [许可](https://unsplash.com/license) |
| Jeddah | 吉达巴拉德老城传统建筑 | Yasser Mutwakil ياسر متوكل | [原图](https://unsplash.com/photos/a-green-and-white-building-with-green-shutters-iO7PF1dHklY) · [许可](https://unsplash.com/license) |
| Riyadh | 利雅得王国中心 | Ibrahim Abdullah | [原图](https://unsplash.com/photos/kingdom-centre-skyscraper-in-riyadh-_UxsPARhtOg) · [许可](https://unsplash.com/license) |
| Almaty | 阿拉木图升天大教堂 | ezz sharaby | [原图](https://unsplash.com/photos/a-large-yellow-building-with-a-clock-tower-4ZpDWtUhivo) · [许可](https://unsplash.com/license) |
| Tbilisi | 第比利斯城市与山景 | Nikita Ermilov | [原图](https://unsplash.com/photos/a-view-of-a-city-with-mountains-in-the-background-jMQELdmkztU) · [许可](https://unsplash.com/license) |
| Tashkent | 塔什干哈兹拉特伊玛目建筑群瓷砖拱门 | Nizar F | [原图](https://unsplash.com/photos/ornate-arched-mosque-entrance-with-tiles-jRMq4kA89XY) · [许可](https://unsplash.com/license) |

MCT 海湾图作者按核对时原始照片页显示为 Sebastian S（@izeberg），搜索摘要中旧显示名不沿用。BAH 为麦纳麦城市入口；安曼照片为城堡山视角及罗马剧场，不借用佩特拉等其他约旦城市景点。

## 欧洲城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Budapest | 布达佩斯国会大厦与多瑙河 | Krisztian Tabori | [原图](https://unsplash.com/photos/hungarian-parliament-building-in-budapest-EyDPhY_idpQ) · [许可](https://unsplash.com/license) |
| Krakow | 克拉科夫中央集市广场与圣母圣殿 | Severinus Dewantara | [原图](https://unsplash.com/photos/people-walking-near-canopies-in-front-of-buildings-during-daytime-0fl-WGMuNPA) · [许可](https://unsplash.com/license) |
| Dubrovnik | 杜布罗夫尼克老城与亚得里亚海 | László Tóth | [原图](https://unsplash.com/photos/aerial-view-of-city-buildings-near-body-of-water-during-daytime-1VskzgDedmo) · [许可](https://unsplash.com/license) |
| Edinburgh | 卡尔顿山杜格尔德·斯图尔特纪念亭与爱丁堡城市景观 | Connor Mollison | [原图](https://unsplash.com/photos/dugald-stewart-monument-in-edinburgh-d7_TtRp1s9s) · [许可](https://unsplash.com/license) |
| Venice | 威尼斯大运河 | Luca Bravo | [原图](https://unsplash.com/photos/grand-canal-venice-Wt2ZI8FDPyI) · [许可](https://unsplash.com/license) |
| Florence | 佛罗伦萨城市与圣母百花大教堂 | Henrique Ferreira | [原图](https://unsplash.com/photos/florence-cityscape-with-duomo-cathedral-at-sunrise-zMFxCtkn9vI) · [许可](https://unsplash.com/license) |
| Naples | 那不勒斯海湾与维苏威火山 | salvatore fasolo | [原图](https://unsplash.com/photos/the-sun-is-setting-over-a-city-with-a-mountain-in-the-background-gX5tYr3J-bo) · [许可](https://unsplash.com/license) |
| Malta | 马耳他瓦莱塔海滨城市景观 | Aleksandrs Zeltisevs | [原图](https://unsplash.com/photos/valletta-cityscape-with-a-dome-and-spire-by-the-sea-SUawlysrJlg) · [许可](https://unsplash.com/license) |

MLA 是地点目录中的马耳他城市/机场入口，采用瓦莱塔海滨，主体明确为瓦莱塔，不标作鲁卡市区。NAP 使用那不勒斯海湾与维苏威火山，EDI 使用卡尔顿山纪念亭及城市景观。未自动加入特雷维索、比萨等独立城市机场。

## 大洋洲城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Queenstown | 皇后镇与瓦卡蒂普湖 | Sung Jin Cho | [原图](https://unsplash.com/photos/an-aerial-view-of-a-lake-surrounded-by-mountains-K3uTZdnaagM) · [许可](https://unsplash.com/license) |
| Christchurch | 基督城雅芳河与河畔树景 | Jason Dodd | [原图](https://unsplash.com/photos/tall-trees-line-a-calm-river-with-a-bridge-lnYFJlM3Pn4) · [许可](https://unsplash.com/license) |
| Wellington | 维多利亚山俯瞰惠灵顿城市与海港 | Hrushi Chavhan | [原图](https://unsplash.com/photos/city-skyline-on-a-bay-with-green-hills-3HQrRBkmikc) · [许可](https://unsplash.com/license) |
| Gold Coast | 黄金海岸城市与海滩 | Peter Cover | [原图](https://unsplash.com/photos/a-coastal-city-skyline-meets-the-ocean-ogQZMr6VWfU) · [许可](https://unsplash.com/license) |
| Cairns | 凯恩斯棕榈湾海滩航拍 | Arun Clarke | [原图](https://unsplash.com/photos/aerial-view-of-sea-during-daytime-yhLBo7cOqhA) · [许可](https://unsplash.com/license) |
| Adelaide | 阿德莱德城市与绿地 | Ben | [原图](https://unsplash.com/photos/a-view-of-a-city-from-a-hill-HlGEM72pd1g) · [许可](https://unsplash.com/license) |
| Hobart | 霍巴特海滨与港湾船只 | Nico Smit | [原图](https://unsplash.com/photos/several-boats-are-docked-in-a-harbor-in-front-of-a-large-building-ivfGgTsubJc) · [许可](https://unsplash.com/license) |
| Nadi | 楠迪斯里湿婆苏布拉马尼亚神庙彩雕 | Adam Young | [原图](https://unsplash.com/photos/a-vibrant-colorful-hindu-temple-tower-with-intricate-carvings-H1b6FFIMVS8) · [许可](https://unsplash.com/license) |

CNS 为凯恩斯棕榈湾海滩（Palm Cove），保留具体海岸地名，不标成市中心或泛称大堡礁。ZQN 为皇后镇与瓦卡蒂普湖；WLG 为维多利亚山视角。NAN 为楠迪市内斯里湿婆苏布拉马尼亚神庙雕饰，未采用其他斐济岛屿图片。

## 亚洲旅行城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Fukuoka | 福冈塔与海滨 | Johanna | [原图](https://unsplash.com/photos/city-skyline-under-white-clouds-during-daytime-G3jsqs6ARWc) · [许可](https://unsplash.com/license) |
| Nagoya | 名古屋城 | Gang Hao | [原图](https://unsplash.com/photos/nagoya-castle-stands-tall-against-a-blue-sky-8Zq_cYOJ4ZU) · [许可](https://unsplash.com/license) |
| Okinawa | 冲绳那霸波上宫鸟居与殿堂 | Zion C | [原图](https://unsplash.com/photos/a-stone-torii-gate-leads-to-a-traditional-japanese-shrine-lyXWmbeHpCg) · [许可](https://unsplash.com/license) |
| Sapporo | 札幌大通公园冬季灯饰与电视塔 | Dominic Kurniawan Suryaputra | [原图](https://unsplash.com/photos/a-city-at-night-with-a-fountain-in-the-foreground-LpPW2FPypi0) · [许可](https://unsplash.com/license) |
| Nha Trang | 芽庄海滩与城市海岸线 | Huy | [原图](https://unsplash.com/photos/aerial-view-of-beach-dLkyhhC-e6Y) · [许可](https://unsplash.com/license) |
| Dalat | 大叻春香湖与湖面船只 | Tan Loc | [原图](https://unsplash.com/photos/a-group-of-boats-floating-on-top-of-a-body-of-water-ABbXZVEKc3Y) · [许可](https://unsplash.com/license) |
| Davao City | 达沃圣佩德罗街钟楼 | Joseph Sullan | [原图](https://unsplash.com/photos/a-tall-tower-with-a-clock-on-the-top-of-it-URHhHG0XIJU) · [许可](https://unsplash.com/license) |
| Dhaka | 达卡拉尔巴格堡建筑与庭园 | Abdullah AL IMRAN | [原图](https://unsplash.com/photos/a-couple-of-people-that-are-standing-in-front-of-a-building-2rxRDvwdTjw) · [许可](https://unsplash.com/license) |

OKA 明确为冲绳那霸波上宫，不采用其他冲绳岛屿的海滩。DLI 为大叻春香湖；DVO 钟楼按实际照片不标为暮色。DAC 保留拉尔巴格堡建筑与庭园的宽泛说明，未沿用来源描述中具体建筑归属。NHA 全景为 1800×817；城市 NHA 对应的金兰国际机场 CXR 显式使用该城市照片。SPK 的 CTS/OKD 和 NGO 的 NGO/NKM 按地点目录城市归属共用，覆盖口径不代表航班在售。

## 拉美与加勒比城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Havana | 哈瓦那海滨与城市天际线 | Pavel | [原图](https://unsplash.com/photos/a-large-body-of-water-with-a-city-in-the-background-JbwA1eZplEs) · [许可](https://unsplash.com/license) |
| Cancun | 坎昆海岸与碧海航拍 | Fernando Garcia | [原图](https://unsplash.com/photos/aerial-view-of-city-buildings-near-sea-during-daytime-J2UUyq3S_Ik) · [许可](https://unsplash.com/license) |
| San Juan | 老圣胡安彩色建筑街景 | Zixi Zhou | [原图](https://unsplash.com/photos/a-row-of-colorful-buildings-on-a-city-street-c8-XRo4a_VM) · [许可](https://unsplash.com/license) |
| Panama City | 巴拿马城城市景观 | Fabrice Parchet | [原图](https://unsplash.com/photos/city-skyline-during-day-time-KWEllBjrSVM) · [许可](https://unsplash.com/license) |
| San Jose | 哥斯达黎加圣何塞城市与山景 | César Badilla Miranda | [原图](https://unsplash.com/es/fotos/una-vista-de-una-ciudad-con-una-montana-al-fondo-oAr-7z3id2A) · [许可](https://unsplash.com/license) |
| Cartagena | 卡塔赫纳历史中心街景与教堂塔楼 | Zane Bolen | [原图](https://unsplash.com/es/fotos/calle-historica-con-cupula-catedralicia-gente-y-coches-Qg0ci7cH7e4) · [许可](https://unsplash.com/license) |
| Quito | 基多卡罗莱纳公园与城市山景 | Anton Lukin | [原图](https://unsplash.com/photos/quito-with-mountains-in-the-background-EGWMTm9tIto) · [许可](https://unsplash.com/license) |
| La Paz | 拉巴斯缆车与山城 | Andrea Huls Pareja | [原图](https://unsplash.com/es/fotos/teleferico-sobre-una-ciudad-en-una-colina-con-montanas-p651n4mL0Zw) · [许可](https://unsplash.com/license) |

SJO 明确为哥斯达黎加圣何塞（Empalme），不是美国同名城市；SJU 为波多黎各老圣胡安，LPB 为玻利维亚拉巴斯，不借用墨西哥同名城市景观。CTG 为哥伦比亚卡塔赫纳历史中心，不使用西班牙同名城市图片。UIO 为基多卡罗莱纳公园周边城市与山景，未以其他厄瓜多尔景点代替。

## 欧洲首都扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Dublin | 都柏林利菲河与城市日落 | Henrique S. Ruzzon | [原图](https://unsplash.com/photos/city-skyline-across-body-of-water-during-daytime-csOD0h4eCk4) · [许可](https://unsplash.com/license) |
| Brussels | 布鲁塞尔大广场建筑 | Hanlin Sun | [原图](https://unsplash.com/photos/a-group-of-people-standing-in-front-of-a-building-4cK7ZiqVuRU) · [许可](https://unsplash.com/license) |
| Warsaw | 华沙老城与城堡广场 | Lāsma Artmane | [原图](https://unsplash.com/photos/city-during-day-p6gxHYb43v0) · [许可](https://unsplash.com/license) |
| Bucharest | 布加勒斯特议会宫 | Linda Gerbec | [原图](https://unsplash.com/photos/a-large-building-with-a-lot-of-cars-parked-in-front-of-it-quSCCW3yODc) · [许可](https://unsplash.com/license) |
| Tallinn | 塔林老城冬景与塔楼 | Margo Evardson | [原图](https://unsplash.com/photos/historic-tallinn-skyline-with-medieval-architecture-and-towers-B621HirU38s) · [许可](https://unsplash.com/license) |
| Riga | 里加老城屋顶与城市景观 | Tom Podmore | [原图](https://unsplash.com/photos/a-view-of-a-city-from-a-window-bal4ODerCeg) · [许可](https://unsplash.com/license) |
| Vilnius | 维尔纽斯老城与热气球 | Igor Gubaidulin | [原图](https://unsplash.com/photos/aerial-photography-of-brown-buildings-during-daytime-34DRz7uAM6k) · [许可](https://unsplash.com/license) |
| Sofia | 索非亚亚历山大·涅夫斯基主教座堂 | Hongbin | [原图](https://unsplash.com/photos/the-alexander-nevsky-cathedral-is-a-stunning-sight-Kxq47tC2Avg) · [许可](https://unsplash.com/license) |

SOF 的亚历山大·涅夫斯基主教座堂明确为保加利亚索非亚，不与塔林同名教堂混用。BUH 作为城市入口，显式关联 OTP/BBU；未将布鲁塞尔照片自动分配到沙勒罗瓦等其他城市。VNO 原图热气球顶部即超出画面，主体说明保留老城与热气球，不声称完整气球全景。

## 非洲城市与自然风景扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Luxor | 卢克索卡尔纳克神庙石像与柱廊 | 2H Media | [原图](https://unsplash.com/photos/a-group-of-people-standing-in-front-of-a-building-with-columns-HRqjELAKBQg) · [许可](https://unsplash.com/license) |
| Sharm el Sheikh | 沙姆沙伊赫海滨与棕榈树 | Omar Elsharawy | [原图](https://unsplash.com/photos/a-beach-with-palm-trees-and-a-body-of-water-Figb0H3ExRw) · [许可](https://unsplash.com/license) |
| Hurghada | 赫尔加达码头与清真寺 | Thomas K | [原图](https://unsplash.com/photos/mosque-on-the-water-with-two-tall-minarets-zXYKjpp5DTM) · [许可](https://unsplash.com/license) |
| Accra | 阿克拉独立广场 | WyteShot 📸 | [原图](https://unsplash.com/photos/ghanas-independence-square-with-flags-and-a-clear-sky-9VfgaIH_mJM) · [许可](https://unsplash.com/license) |
| Lagos | 尼日利亚拉各斯莱基—伊科伊大桥 | Tunde Buremo | [原图](https://unsplash.com/photos/a-large-bridge-over-a-large-body-of-water-xayCN6mrMZ8) · [许可](https://unsplash.com/license) |
| Dakar | 达喀尔维拉日海滩日落 | Omoniyi David | [原图](https://unsplash.com/photos/the-sun-is-setting-over-the-beach-and-the-water-AjB2K0k4Sts) · [许可](https://unsplash.com/license) |
| Windhoek | 温得和克基督教堂 | Ndumiso | [原图](https://unsplash.com/photos/brown-and-beige-concrete-building-under-blue-sky-during-daytime-ibu9zUnkLFw) · [许可](https://unsplash.com/license) |
| Victoria Falls | 津巴布韦维多利亚瀑布 | Ian Mackey | [原图](https://unsplash.com/photos/a-view-of-a-waterfall-from-a-distance-nsm-gUKDMeQ) · [许可](https://unsplash.com/license) |

LXR 最终采用地点与主体说明一致的卡尔纳克神庙照片，舍弃标题与描述分别指向 Karnak/Luxor Temple 的早期候选。VFA 采用原图明确标为 Victoria Falls, Zimbabwe 的瀑布景观，不扩展至赞比亚利文斯通。LOS 明确尼日利亚莱基—伊科伊大桥，不与葡萄牙拉各斯混用；DKR 明确达喀尔维拉日海滩（Virage beach），显式关联地点目录中的 DSS 入口。

## 亚洲与中东城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Baku | 巴库火焰塔与城市天际线 | Zulfugar Karimov | [原图](https://unsplash.com/photos/modern-baku-skyline-featuring-flame-towers-and-tv-tower-NkPzeYwCuFQ) · [许可](https://unsplash.com/license) |
| Yerevan | 埃里温城市与阿拉拉特山远景 | Artak Petrosyan | [原图](https://unsplash.com/photos/aerial-photography-of-city-buildings-vwvshYHYAZs) · [许可](https://unsplash.com/license) |
| Astana | 阿斯塔纳城市建筑夜景 | Snowscat | [原图](https://unsplash.com/photos/buildings-during-nighttime-bZai-fXBVIg) · [许可](https://unsplash.com/license) |
| Bishkek | 比什凯克市政厅周边广场与绿荫大道 | Mike Dudin | [原图](https://unsplash.com/photos/aerial-view-of-city-buildings-during-daytime-oFXyWtZ2cDU) · [许可](https://unsplash.com/license) |
| Tel Aviv | 特拉维夫海滩与城市天际线 | Joshi Milestoner | [原图](https://unsplash.com/photos/people-enjoy-the-beach-in-front-of-a-city-skyline-6_vhZ7IHmRg) · [许可](https://unsplash.com/license) |
| Beirut | 贝鲁特劳谢鸽子岩与海岸 | Michelle Williams | [原图](https://unsplash.com/photos/a-couple-of-large-rocks-sitting-in-the-middle-of-a-body-of-water-0S7x7tP5lz4) · [许可](https://unsplash.com/license) |
| Islamabad | 伊斯兰堡费萨尔清真寺与山景 | Mirza Zubair | [原图](https://unsplash.com/photos/faisal-mosque-with-surrounding-plaza-and-mountains-at-sunset-QGJEa2tG3PI) · [许可](https://unsplash.com/license) |
| Karachi | 卡拉奇真纳陵 | Hassan Anwer | [原图](https://unsplash.com/photos/people-walking-near-white-concrete-building-during-daytime-I_n4H25slzU) · [许可](https://unsplash.com/license) |

BAK 为巴库城市入口，显式关联 GYD；BSZ、NQZ 使用当前地点目录代码，未自行加入旧机场代码。EVN 为从埃里温眺望阿拉拉特山，不把远处山峰标为市内景点。BEY 为贝鲁特劳谢岩（鸽子岩）。ISB 为费萨尔清真寺；KHI 为真纳陵。NQZ 实页复查后采用河畔建筑夜景与倒影，舍弃天空占比过大、建筑易被卡片裁掉的清真寺/纪念柱候选，不沿用早期候选主体名称。

## 美国热门城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Miami | 迈阿密南海滩与城市暮色 | Jairo Gonzalez | [原图](https://unsplash.com/photos/aerial-view-of-a-beach-city-skyline-at-dusk-hB2R47qB8yA) · [许可](https://unsplash.com/license) |
| Orlando | 奥兰多伊奥拉湖与城市晨景 | Mick Haupt | [原图](https://unsplash.com/photos/city-skyline-across-body-of-water-during-daytime-Tyn3-Cljx-A) · [许可](https://unsplash.com/license) |
| Denver | 丹佛城市天际线与落基山远景 | Bill Griepenstroh | [原图](https://unsplash.com/photos/a-view-of-a-city-with-mountains-in-the-background-Q9X_p5dDq_8) · [许可](https://unsplash.com/license) |
| Dallas | 达拉斯三一河畔城市夜景 | Max Fray | [原图](https://unsplash.com/photos/city-skyline-during-night-time-V6CQgi7Pgdc) · [许可](https://unsplash.com/license) |
| Austin | 奥斯汀城市与国会大道桥 | Carlos Delgado | [原图](https://unsplash.com/photos/austin-skyline-and-congress-avenue-bridge-AlBgcDfDG_s) · [许可](https://unsplash.com/license) |
| New Orleans | 新奥尔良法式建筑与花卉阳台 | Stella He | [原图](https://unsplash.com/photos/a-building-with-a-balcony-with-flowers-on-the-balconies-0838a5VoJ2Y) · [许可](https://unsplash.com/license) |
| San Diego | 圣迭戈海湾城市蓝调夜景 | Himmel S | [原图](https://unsplash.com/photos/a-view-of-a-city-at-night-from-across-the-water-iLi4U0eskGk) · [许可](https://unsplash.com/license) |
| Portland | 俄勒冈州波特兰霍桑桥与威拉米特河 | Anthony Sebbo | [原图](https://unsplash.com/photos/steel-drawbridge-over-a-wide-river-with-city-skyline-BbEOsCHhAv8) · [许可](https://unsplash.com/license) |

MIA 明确为迈阿密海滩南海滩（Miami Beach - South Beach），不标为迈阿密市中心。SAN 为从科罗纳多海湾对岸眺望圣迭戈天际线，不把拍摄站位标为市中心。PDX 为俄勒冈州波特兰霍桑桥与威拉米特河，未与缅因州同名城市混用。ORL 城市入口关联 MCO；DFW 与 DAL 共用达拉斯图，不自动扩展通航机场或桑福德等独立城市入口。

## 欧洲海岛与度假城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Palma | 马略卡帕尔马主教座堂与水面倒影 | Lucas Klein | [原图](https://unsplash.com/photos/palma-cathedral-reflected-in-the-water-under-a-clear-sky-vSvpqr8yfns) · [许可](https://unsplash.com/license) |
| Ibiza | 伊维萨萨佩尼亚街区与海港 | Mihai Dragomirescu | [原图](https://unsplash.com/photos/a-view-of-a-city-with-a-body-of-water-in-the-background-5tq-orrVVuI) · [许可](https://unsplash.com/license) |
| Tenerife | 特内里费山间云海与日落 | Richard Powazynski | [原图](https://unsplash.com/photos/sun-setting-over-the-beach-ZHdXVG4Yfp8) · [许可](https://unsplash.com/license) |
| Funchal | 丰沙尔城市与山坡全景 | Erik Karits | [原图](https://unsplash.com/photos/an-aerial-view-of-a-city-with-a-hill-in-the-background-lrNh6Aks-u8) · [许可](https://unsplash.com/license) |
| Rhodes | 罗得岛老城街景 | Bradley Pritchard Jones | [原图](https://unsplash.com/photos/a-group-of-people-standing-around-a-stone-building-Ad-Zb6nS4j8) · [许可](https://unsplash.com/license) |
| Corfu | 科孚城市与海岸 | Alex Ghiurau | [原图](https://unsplash.com/photos/a-view-of-a-city-and-a-body-of-water-3F9bBeZqas4) · [许可](https://unsplash.com/license) |
| Larnaca | 拉纳卡海滩与城市海岸 | Hert Niks | [原图](https://unsplash.com/photos/people-on-beach-during-daytime-PDoWMD5cy9I) · [许可](https://unsplash.com/license) |
| Reykjavik | 雷克雅未克城市与哈尔格林姆教堂 | Oskar Kadaksoo | [原图](https://unsplash.com/photos/reykjavik-skyline-with-hallgrimskirkja-church-818-g9biFwQ) · [许可](https://unsplash.com/license) |

TCI 为特内里费岛入口，原图为山间云海与日落，不声称画面完整展示泰德峰；TFS/TFN 显式共用。REK 为雷克雅未克城市及哈尔格林姆教堂远景，显式关联 KEF/RKV；不把城市天际线标成凯夫拉维克市区。IBZ 为伊维萨萨佩尼亚街区，FNC 为丰沙尔山坡城市，未借用其他巴利阿里岛屿或马德拉岛外景观。

## 东南亚城市与海岛扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Jakarta | 雅加达跨年夜城市天际线 | Alim | [原图](https://unsplash.com/photos/a-view-of-a-city-skyline-at-night-l-lVSTwygwQ) · [许可](https://unsplash.com/license) |
| Surabaya | 泗水城市夜景 | dulz muhammad | [原图](https://unsplash.com/photos/a-view-of-a-city-at-night-from-across-the-water-IgFXRioeVoc) · [许可](https://unsplash.com/license) |
| Kuching | 古晋砂拉越河岸与议会大厦 | Masrur Rahman | [原图](https://unsplash.com/id/foto/perahu-di-depan-gedung-AnZR28Z-Kpc) · [许可](https://unsplash.com/license) |
| Langkawi | 兰卡威海滩与海景 | Eirik Skarstein | [原图](https://unsplash.com/photos/a-group-of-people-standing-on-top-of-a-beach-next-to-the-ocean-TdOjtlRdPes) · [许可](https://unsplash.com/license) |
| Bandar Seri Begawan | 斯里巴加湾清真寺金色穹顶 | Hung Li | [原图](https://unsplash.com/photos/a-large-white-building-with-a-gold-dome-S401uGs3tCc) · [许可](https://unsplash.com/license) |
| Vientiane | 万象塔銮建筑群 | Life on the road | [原图](https://unsplash.com/photos/a-large-white-building-with-a-clock-on-its-side-IT0mLyktFS4) · [许可](https://unsplash.com/license) |
| Phnom Penh | 金边王宫夜景 | Pech Visoth | [原图](https://unsplash.com/photos/a-large-building-with-a-clock-tower-at-night-V3IWUGip69s) · [许可](https://unsplash.com/license) |
| Dili | 帝力基督像海滩日落 | Tanushree Rao | [原图](https://unsplash.com/photos/body-of-water-QO5YIYkdQ1o) · [许可](https://unsplash.com/license) |

JKT 显式关联 CGK/HLP；PNH 显式关联 PNH/KTI（德崇国际机场），共用金边城市照片。BWN 按画面记录为清真寺金色穹顶，来源地点标注 Jame’ Asr Hassanil Bolkiah Mosque；不采用另一候选图中存在疑点的清真寺名称。DIL 为 Cristo Rei 海岸日落，不声称画面完整展示基督像。

## 南亚城市与历史地标扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Kolkata | 加尔各答维多利亚纪念堂 | Harsh Mangalam | [原图](https://unsplash.com/photos/grand-white-building-with-dome-and-surrounding-greenery-PuPpQZt9EfQ) · [许可](https://unsplash.com/license) |
| Hyderabad | 海德拉巴查米纳塔 | Sunny | [原图](https://unsplash.com/photos/the-charminar-a-historical-monument-in-india-LDYbI5R6vaM) · [许可](https://unsplash.com/license) |
| Kochi | 科钦堡海岸传统渔网 | gaurav kumar | [原图](https://unsplash.com/photos/white-and-blue-tent-on-gray-sand-during-daytime-33Z4FsBTiAY) · [许可](https://unsplash.com/license) |
| Amritsar | 阿姆利则金庙建筑群与倒影 | Sarbjit Singh | [原图](https://unsplash.com/photos/golden-temple-complex-reflected-in-the-water-B2m_X74OSpA) · [许可](https://unsplash.com/license) |
| Paro | 帕罗虎穴寺与山林 | Gaurav Bagdi | [原图](https://unsplash.com/photos/white-and-brown-concrete-house-on-rocky-mountain-during-daytime-OzAPEQPMcPA) · [许可](https://unsplash.com/license) |
| Lahore | 拉合尔巴德夏希清真寺 | Shazaf Zafar | [原图](https://unsplash.com/photos/brown-and-white-dome-building-under-white-sky-during-daytime-Mxqf5YycXug) · [许可](https://unsplash.com/license) |

PBH 使用帕罗 Taktsang Trail 旁虎穴寺山景，不称市中心。COK 为印度 Kerala 的 Fort Kochi 海岸渔网，并非日本高知；ATQ 全景保留为 1800×810。HYD 仅关联海德拉巴现有客运入口 HYD，未扩展到目录中的 BPM。

## 巴尔干城市与首都扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Ljubljana | 卢布尔雅那城堡与秋日城市 | ALEKO KEZEVADZE | [原图](https://unsplash.com/photos/ljubljana-castle-overlooks-a-city-with-autumn-trees-wwKLeuAmwtM) · [许可](https://unsplash.com/license) |
| Zagreb | 萨格勒布圣马可教堂 | martin bennie | [原图](https://unsplash.com/photos/a-person-standing-in-front-of-a-white-building-with-a-red-roof-b5pNdvkMDs0) · [许可](https://unsplash.com/license) |
| Belgrade | 贝尔格莱德西门塔日落 | Ivan Aleksic | [原图](https://unsplash.com/photos/the-sun-is-setting-over-a-city-with-tall-buildings-b-JXNiCBgWw) · [许可](https://unsplash.com/license) |
| Sarajevo | 萨拉热窝山谷城市全景 | ray rui | [原图](https://unsplash.com/photos/a-dense-city-sprawls-across-a-hilly-landscape-hTI4eR6_I8c) · [许可](https://unsplash.com/license) |
| Tirana | 地拉那城市与广场 | Pearb Spathara | [原图](https://unsplash.com/photos/an-aerial-view-of-a-soccer-field-in-a-city-fUuTZkZD97I) · [许可](https://unsplash.com/license) |
| Skopje | 斯科普里河岸与城市建筑 | Robert Bahn | [原图](https://unsplash.com/photos/bridge-over-water-near-city-buildings-during-daytime-r2wiL6QzNco) · [许可](https://unsplash.com/license) |
| Podgorica | 波德戈里察斜拉桥夜景 | Alexandr Voronsky | [原图](https://unsplash.com/photos/a-large-tower-with-lights-NYGy4sHuYbo) · [许可](https://unsplash.com/license) |

LJU 为卢布尔雅那城堡及城市航拍，未借用布莱德湖；ZAG 为圣马可教堂。BEG 来源明确 Genex tower 日落。SJJ 为山谷城市全景；TIA 为城市广场临时活动场景，不当作常设球场。TGD 采用斜拉桥夜间建筑细节，未采用首张来源中桥梁名称与实际现代桥画面不一致的候选。

## 土耳其及黑海城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Antalya | 安塔利亚老港与城市 | Ant Rozetsky | [原图](https://unsplash.com/photos/a-harbor-filled-with-lots-of-boats-next-to-a-city-K6pcgoxD0yw) · [许可](https://unsplash.com/license) |
| Izmir | 伊兹密尔海滨日落 | Taha Berk Tekin | [原图](https://unsplash.com/photos/a-sunset-over-a-body-of-water-with-a-city-in-the-background-ZYplhVpEBqI) · [许可](https://unsplash.com/license) |
| Ankara | 安卡拉阿塔图尔克陵建筑群 | MOHAMMED SAMI | [原图](https://unsplash.com/photos/a-group-of-people-standing-in-front-of-a-building-baFXo8UpRP0) · [许可](https://unsplash.com/license) |
| Bodrum | 博德鲁姆城堡与海港 | Adem Percem | [原图](https://unsplash.com/photos/bodrum-turkey-cityscape-with-castle-and-harbor-BNxbZAd2iN0) · [许可](https://unsplash.com/license) |
| Nevsehir | 内夫谢希尔周边卡帕多奇亚热气球 | Umi Itu Laut | [原图](https://unsplash.com/photos/a-group-of-hot-air-balloons-in-the-sky-with-cappadocia-in-the-background-mE-OJ7xAqzU) · [许可](https://unsplash.com/license) |
| Batumi | 巴统傍晚城市天际线 | mariam metreveli | [原图](https://unsplash.com/photos/a-city-with-tall-buildings-and-a-body-of-water-h7677imeqy0) · [许可](https://unsplash.com/license) |

AYT 为安塔利亚卡莱伊奇老港，未借用阿拉尼亚海港。NAV 为内夫谢希尔周边卡帕多奇亚热气球及岩谷景观，非城市中心，来源未细分具体山谷；不扩展到开塞利 ASR。ANK 显式关联 ESB，IZM 关联 ADB；未扩展 IGL、BXN。BJV 原图明确为博德鲁姆城堡与海港，BUS 为巴统城市傍晚景观。

## 南美城市、海岸与山景扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Medellin | 麦德林山谷城市全景 | Jose Figueroa | [原图](https://unsplash.com/photos/a-view-of-a-city-with-mountains-in-the-background-niF21NBzPjI) · [许可](https://unsplash.com/license) |
| Guayaquil | 瓜亚基尔城市日落航拍 | Andres Medina | [原图](https://unsplash.com/photos/aerial-view-of-city-buildings-during-sunset-49_PpVFXbGg) · [许可](https://unsplash.com/license) |
| Montevideo | 蒙得维的亚滨水城市与棕榈树 | Nikolai Kolosov | [原图](https://unsplash.com/photos/coastal-city-skyline-with-palm-trees-and-green-grass-qMY6wKT5hEE) · [许可](https://unsplash.com/license) |
| Ushuaia | 乌斯怀亚城市与雪山海湾 | Diego Costa | [原图](https://unsplash.com/photos/snow-capped-mountains-overlook-a-coastal-town-and-calm-sea-WVvrIRLxox4) · [许可](https://unsplash.com/license) |
| Bariloche | 巴里洛切纳韦尔瓦皮湖与群山 | Daniela Paola Alchapar | [原图](https://unsplash.com/photos/a-large-body-of-water-surrounded-by-mountains-vsRvLD6-q7M) · [许可](https://unsplash.com/license) |
| Mendoza | 门多萨葡萄园与山景 | Wadé | [原图](https://unsplash.com/photos/vineyard-with-buildings-and-mountains-at-sunset-no3YzOg1_9k) · [许可](https://unsplash.com/license) |
| Salvador | 巴西萨尔瓦多海港与城市航拍 | SALEM. | [原图](https://unsplash.com/photos/an-aerial-view-of-a-city-with-boats-in-the-water-kq3h39hTR78) · [许可](https://unsplash.com/license) |
| Recife | 巴西累西非海岸灯塔日落 | Raissa Brizeno | [原图](https://unsplash.com/photos/lighthouse-on-a-breakwater-at-sunset-NW8AzCoWVXQ) · [许可](https://unsplash.com/license) |

MDE 显式关联 MDE/EOH，共用麦德林城市山谷景观，不借用瓜塔佩。MVD 为拉普拉塔河口滨水城市，不将其泛称为大西洋沙滩。BRC 为纳韦尔瓦皮湖与群山，MDZ 为门多萨葡萄园和山景，均非市中心街道。SSA 明确为巴西巴伊亚州萨尔瓦多，REC 明确为巴西伯南布哥州累西非，非萨尔瓦多国或南非 Cape Recife。

## 英国及爱尔兰城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Manchester | 曼彻斯特城市天际线 | Mylo Kaye | [原图](https://unsplash.com/photos/a-view-of-a-city-from-the-top-of-a-building-NXtGjC7osPs) · [许可](https://unsplash.com/license) |
| Glasgow | 格拉斯哥克莱德河与城市 | Adam Marikar | [原图](https://unsplash.com/photos/body-of-water-between-high-rise-building-7vJX8cIgLao) · [许可](https://unsplash.com/license) |
| Belfast | 贝尔法斯特市政厅与街景 | Mark Slomkowski | [原图](https://unsplash.com/photos/a-city-street-with-a-large-building-in-the-background-XppGVV4s2bc) · [许可](https://unsplash.com/license) |
| Bristol | 布里斯托克利夫顿悬索桥暮色 | Orion Grant | [原图](https://unsplash.com/photos/a-bridge-and-tower-are-seen-at-dusk-34DhtEMzntA) · [许可](https://unsplash.com/license) |
| Birmingham | 英国伯明翰运河与城市建筑 | Lucas Cipriano | [原图](https://unsplash.com/photos/apartment-buildings-line-a-canal-with-narrowboats-8oQBKLH6s9c) · [许可](https://unsplash.com/license) |
| Liverpool | 利物浦阿尔伯特码头与滨水建筑 | Gavin Allanwood | [原图](https://unsplash.com/photos/a-beautiful-waterfront-scene-in-liverpool-england-S9EJKHgCmWA) · [许可](https://unsplash.com/license) |
| Newcastle upon Tyne | 泰恩河畔纽卡斯尔桥梁与河岸 | Ryan Booth | [原图](https://unsplash.com/photos/bridge-over-river-near-city-buildings-during-night-time-NXQ1kXQwmzs) · [许可](https://unsplash.com/license) |
| Cork | 爱尔兰科克市政厅与利河夜景 | Jamie O’Sullivan | [原图](https://unsplash.com/photos/a-large-white-building-with-a-clock-tower-at-night-fkb4AdIWiVg) · [许可](https://unsplash.com/license) |

GLA/PIK 共用格拉斯哥城市景观，PIK 为普雷斯蒂克机场入口，不将克莱德河画面称为普雷斯蒂克市区。BFS/BHD 共用贝尔法斯特市政厅图。BHX 为英国伯明翰，NCL 为英国泰恩河畔纽卡斯尔，ORK 为爱尔兰科克，未混用美国伯明翰或澳大利亚纽卡斯尔。LPL 按实际画面记录滨水建筑与码头，未照抄来源中建筑名称的细节描述。

## 法国城市与海岸扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Nice | 尼斯城堡山眺望海岸与城市 | Antoine Gravier | [原图](https://unsplash.com/photos/coastal-city-skyline-with-ocean-waves-and-clear-sky-BEPi6c4CQpw) · [许可](https://unsplash.com/license) |
| Lyon | 里昂城市与河流航拍 | Willian Justen de Vasconcellos | [原图](https://unsplash.com/photos/an-aerial-view-of-a-city-with-a-river-running-through-it-vQ-Lyt-OEeg) · [许可](https://unsplash.com/license) |
| Marseille | 马赛海港与城市 | Hongbin | [原图](https://unsplash.com/photos/a-harbor-filled-with-lots-of-boats-next-to-a-city-w86Etj-p0wI) · [许可](https://unsplash.com/license) |
| Bordeaux | 波尔多建筑夜景与倒影 | Juan Di Nella | [原图](https://unsplash.com/photos/low-angle-photo-of-white-concrete-building-ulhxvMjzI_4) · [许可](https://unsplash.com/license) |
| Toulouse | 图卢兹河岸日落 | DAT VO | [原图](https://unsplash.com/photos/people-sitting-beside-lake-F4u8Vm7UdgY) · [许可](https://unsplash.com/license) |
| Strasbourg | 斯特拉斯堡运河与建筑 | ONUR KURT | [原图](https://unsplash.com/photos/canal-with-buildings-and-trees-on-sunny-day-q1Q_JkCiamE/) · [许可](https://unsplash.com/license) |
| Nantes | 南特皇家广场与喷泉 | Pascal Bernardon | [原图](https://unsplash.com/fr/photos/un-grand-batiment-avec-une-tour-et-une-fontaine-devant-lui-y2oHSYf5N5M) · [许可](https://unsplash.com/license) |
| Lille | 里尔大广场与历史建筑 | Martin Robac | [原图](https://unsplash.com/photos/grand-square-with-historic-buildings-and-monument-riAzFTGPCGc) · [许可](https://unsplash.com/license) |

NCE 来源标明尼斯城堡山观景公园；LYS 为里昂河流与城市，未扩展到格勒诺布尔 GNB。MRS 为马赛旧港及城市，BOD 为波尔多建筑夜景与水面倒影。TLS 按实际画面和来源位置记录图卢兹河岸，未照抄自动标题中的湖泊。SXB 保留来源的城市拼写差异说明：正文标 Strasbourg，位置字段拼作 Starsbourg；画面为斯特拉斯堡运河。NTE 为皇家广场，非公爵城堡；LIL 为里尔大广场。

## 西班牙及意大利城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Valencia | 巴伦西亚艺术科学城与水景 | Thomas K | [原图](https://unsplash.com/photos/modern-architecture-with-bridge-over-water-dkn9FdBS0hQ) · [许可](https://unsplash.com/license) |
| Seville | 塞维利亚都市阳伞与城市 | Andrea Huls Pareja | [原图](https://unsplash.com/photos/modern-wooden-structure-overlooking-a-cityscape-sr85SzSO1qA) · [许可](https://unsplash.com/license) |
| Bilbao | 毕尔巴鄂古根海姆博物馆与内尔维翁河 | Jacek Urbanski | [原图](https://unsplash.com/photos/the-guggenheim-museum-stands-proudly-by-the-river-LmZD5cjDsAg) · [许可](https://unsplash.com/license) |
| Granada | 格拉纳达阿尔罕布拉宫与花园 | Harri P | [原图](https://unsplash.com/photos/alhambra-palace-and-fortress-complex-in-granada-spain-sDbuNT4AS-Y) · [许可](https://unsplash.com/license) |
| Turin | 都灵城市与安托内利尖塔 | Gabriel Castles | [原图](https://unsplash.com/photos/a-view-of-a-city-from-a-high-point-of-view-WSK8iL_ngUw) · [许可](https://unsplash.com/license) |
| Bologna | 博罗尼亚历史广场夜景 | Max Nayman | [原图](https://unsplash.com/photos/arched-buildings-line-a-cobblestone-square-at-night-uKbYzknR4Fc) · [许可](https://unsplash.com/license) |
| Pisa | 比萨奇迹广场与斜塔 | Denis | [原图](https://unsplash.com/photos/a-large-building-with-a-tall-tower-next-to-a-green-field-3lKd1ju4QxM) · [许可](https://unsplash.com/license) |
| Genoa | 热那亚城市与海港 | Steffen Lemmerzahl | [原图](https://unsplash.com/photos/cityscape-with-harbor-and-ocean-view-BZY-1agyud8) · [许可](https://unsplash.com/license) |

VLC 为巴伦西亚艺术科学城，主体按可见建筑和水景记录。SVQ 为都市阳伞俯瞰城市的黑白实拍，非西班牙广场；BIO 采用无遮挡的内尔维翁河畔古根海姆博物馆。GRX 为 Generalife 花园眺望阿尔罕布拉宫，非尼加拉瓜格拉纳达。TRN 为 Monte dei Cappuccini 眺望安托内利尖塔。PSA 为奇迹广场建筑群及斜塔；GOA 为热那亚城市与港口。BLQ 全景保留 1800px 宽版本以满足最小高度，未拉伸。

## 南太平洋海岸扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Rarotonga | 拉罗汤加海岸日落 | Bill Fairs | [原图](https://unsplash.com/photos/person-on-boat-at-golden-hour-mz3-0G5VhrQ) · [许可](https://unsplash.com/license) |
| Noumea | 努美阿山坡眺望海湾 | Nico Smit | [原图](https://unsplash.com/photos/a-view-of-the-ocean-from-a-hill-EyaW2XMu7qM) · [许可](https://unsplash.com/license) |

RAR 原图明确为库克群岛拉罗汤加日落，不借用艾图塔基潟湖。NOU 为努美阿山坡眺望海湾，来源没有命名具体海滩，不自行补充海滩名称。未扩展到其他相邻岛屿或机场。

## 德国与奥地利扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Hamburg | 汉堡仓库城红砖建筑与运河 | Pix Tresa | [原图](https://unsplash.com/photos/historic-brick-buildings-line-a-canal-in-hamburg-l0zoGNr21FU) · [许可](https://unsplash.com/license) |
| Düsseldorf | 杜塞尔多夫媒体港、桥梁与莱茵塔蓝调夜景 | Marcellin Steinhaus | [原图](https://unsplash.com/photos/dusseldorf-skyline-at-night-with-bridge-and-tower-IxEkmkEiOYI) · [许可](https://unsplash.com/license) |
| Cologne | 科隆大教堂、霍亨索伦桥与莱茵河 | Dirk Röhrig | [原图](https://unsplash.com/photos/cologne-cathedral-and-hohenzollern-bridge-over-river-8iK9tG3X7EY) · [许可](https://unsplash.com/license) |
| Stuttgart | 斯图加特王宫广场与新宫 | Margo Evardson | [原图](https://unsplash.com/photos/schlossplatz-in-stuttgart-with-the-new-palace-at-sunset-bvwiunL3iyI) · [许可](https://unsplash.com/license) |
| Dresden | 德累斯顿老城与易北河暮色 | Andres Garcia | [原图](https://unsplash.com/photos/city-skyline-near-body-of-water-during-sunset-JDb166rgmqI) · [许可](https://unsplash.com/license) |
| Nuremberg | 纽伦堡河岸老城建筑 | Thomas Winkler | [原图](https://unsplash.com/photos/brown-concrete-building-near-body-of-water-during-daytime-apBsbVtZROI) · [许可](https://unsplash.com/license) |
| Salzburg | 萨尔茨堡老城与萨尔察赫河全景 | David Fucsku | [原图](https://unsplash.com/photos/panoramic-view-of-salzburg-city-with-salzach-river-HWtkoYbN-D4) · [许可](https://unsplash.com/license) |
| Innsbruck | 因斯布鲁克因河、彩色房屋与阿尔卑斯山 | Sinthujan Thangavelu | [原图](https://unsplash.com/photos/colorful-buildings-line-a-river-with-mountains-behind-fmdjpdYbXZE) · [许可](https://unsplash.com/license) |

杜塞尔多夫首张竖幅候选会在宽卡片截断莱茵塔，改用媒体港横幅蓝调夜景；科隆首张夜景偏暗，改用 Dirk Röhrig 的大教堂与桥梁照片。斯图加特来源自动标题与描述的时段不同，主体只记录王宫广场与新宫。只关联各城市主要机场入口，不把芬克威尔德、吕贝克、韦策或其他附近机场自动加入。当前浏览器关闭，实际页面裁切待验收。

## 德国、瑞士与比利时扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Heidelberg | 海德堡老桥、城堡与内卡河 | Bernd 📷 Dittrich | [原图](https://unsplash.com/photos/a-bridge-over-a-river-with-a-castle-in-the-background-uuJ0woiSpKI) · [许可](https://unsplash.com/license) |
| Bruges | 布鲁日湖畔建筑与倒影 | Kamilla Isalieva | [原图](https://unsplash.com/photos/beautiful-canal-in-bruges-with-iconic-buildings-reflected-wQQN4KXVMu0) · [许可](https://unsplash.com/license) |
| Geneva | 日内瓦花叶前景中的大喷泉 | Allan Ramseyer | [原图](https://unsplash.com/photos/jet-deau-fountain-in-geneva-with-sailboats-on-lake-y8yDDSL4Dmo) · [许可](https://unsplash.com/license) |
| Basel | 巴塞尔莱茵河岸老建筑与现代天际线 | Henrique Ferreira | [原图](https://unsplash.com/photos/city-skyline-with-historic-buildings-and-modern-towers-T4IE35lQlvU) · [许可](https://unsplash.com/license) |
| Bern | 伯尔尼阿勒河与河岸历史建筑 | Margo Evardson | [原图](https://unsplash.com/photos/historic-building-on-a-bright-blue-river-with-green-hills-9gcliC2wZ7k) · [许可](https://unsplash.com/license) |
| Antwerp | 安特卫普大广场建筑与雕像夜景 | Marcus Loke | [原图](https://unsplash.com/photos/white-concrete-building-with-statue-during-night-time-3vOTwWKwQ4A) · [许可](https://unsplash.com/license) |

海德堡使用目录已有 HDB 城市记录，不据此声称有可售航班。OST 城市记录为奥斯坦德-布鲁日，实拍主体按图像记录为布鲁日湖畔建筑倒影，不标成奥斯坦德海岸。巴塞尔使用 EAP 城市记录和目录对应 BSL、MLH 入口；两者为同一欧机场的入口代码，不增加独立照片数量。根特缺少当前城市记录，尚未接入。海德堡与伯尔尼竖幅候选改为横幅河景；巴塞尔工业背景桥梁改为河岸建筑天际线。日内瓦为花叶前景框住大喷泉，未据帆船自动标题增补主体；安特卫普保留真实广场夜间摊位。当前浏览器关闭，实际页面裁切待验收。

## 日本地方旅行城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Hiroshima | 广岛城、樱花与护城河倒影 | Delano Ramdas | [原图](https://unsplash.com/photos/a-japanese-castle-surrounded-by-cherry-blossoms-and-trees-GdQSGUascKg) · [许可](https://unsplash.com/license) |
| Sendai | 仙台市区街景 | hyun kim | [原图](https://unsplash.com/photos/a-city-street-filled-with-lots-of-traffic-next-to-tall-buildings-ibjZpTdzW-I) · [许可](https://unsplash.com/license) |
| Nagasaki | 长崎港与城市全景 | Roméo A. | [原图](https://unsplash.com/photos/a-large-body-of-water-surrounded-by-a-city-ERVZMxv0hQw) · [许可](https://unsplash.com/license) |
| Kagoshima | 鹿儿岛樱岛火山与海湾 | Parco Chan | [原图](https://unsplash.com/photos/black-and-white-mountain-under-white-clouds-during-daytime-OL0VKdO8JvI) · [许可](https://unsplash.com/license) |
| Kumamoto | 熊本城 | Luo Jin Hong | [原图](https://unsplash.com/photos/a-majestic-japanese-castle-stands-tall-RrJFehtvgd4) · [许可](https://unsplash.com/license) |
| Takamatsu | 高松栗林公园园林景色 | H C | [原图](https://unsplash.com/photos/a-japanese-garden-with-rocks-and-trees-UCaGli9BqF0) · [许可](https://unsplash.com/license) |

广岛使用广岛城实拍，不把其他城堡或宫岛风景标成广岛城。鹿儿岛使用樱岛与海湾原图，未以其他火山替代；原自动标题称黑白，实际色彩以原图为准。高松明确为栗林公园。机场仅采用各城主要机场，不自行扩展已停用的广岛西入口。小松、大分未在本批接入，当前搜索结果多为京都等其他城市；缺口继续保留。广岛首张为城墙角楼竖幅，第二张天守为偏暗竖幅，改选第三张城堡、樱花与倒影。鹿儿岛首张远景薄雾遮山，改选海湾火山画面；1600px 版本高 533px，改下载 2600px 版本，不拉伸图像。仙台为竖幅市区街景，当前浏览器关闭，实际页面裁切待验收。

## 美国与加拿大城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Philadelphia | 从卡姆登隔特拉华河眺望费城天际线 | Salonagility.com Daniel | [原图](https://unsplash.com/photos/city-skyline-under-blue-sky-during-daytime-NbFCCJZ0j-8) · [许可](https://unsplash.com/license) |
| Pittsburgh | 匹兹堡黄昏天际线与河流 | Megan Majocha | [原图](https://unsplash.com/photos/pittsburghs-skyline-and-river-glow-in-evening-light-E5JyfeqIO8E) · [许可](https://unsplash.com/license) |
| Quebec City | 魁北克老城、芳堤娜城堡酒店与河岸蓝调暮色 | Mike Bryant | [原图](https://unsplash.com/photos/fairmont-le-chateau-frontenac-overlooking-the-saint-lawrence-river-xjZvkH2_mG8) · [许可](https://unsplash.com/license) |
| Halifax | 哈利法克斯水岸城市天际线 | Jeffrey Eisen | [原图](https://unsplash.com/photos/city-skyline-with-waterfront-buildings-and-sunny-sky-tfRq4thm8rA) · [许可](https://unsplash.com/license) |
| Salt Lake City | 盐湖城天际线与远山 | Brent Pace | [原图](https://unsplash.com/photos/a-view-of-a-city-with-mountains-in-the-background-Gy0pBQ5okpM) · [许可](https://unsplash.com/license) |
| Victoria | 加拿大维多利亚内港暮色 | Vlad D | [原图](https://unsplash.com/photos/a-large-body-of-water-with-a-city-in-the-background-OE8EYB7fXMk) · [许可](https://unsplash.com/license) |

费城原图从新泽西州卡姆登隔特拉华河拍摄费城天际线，主体明确为费城，不改写拍摄地点。魁北克城、维多利亚及哈利法克斯均核对加拿大位置；不以魁北克省其他地点或同名维多利亚城市替代。YYJ 与 YWH 共用维多利亚图：地点目录均归属 YYJ，Harbour Air 官方 [Victoria Harbour 位置页](https://harbourair.com/locations/victoria-harbour/)列明 YWH 内港客运码头；不据此推断存在具体航班报价。未自动关联特伦顿、通用航空或军用机场。当前浏览器关闭，实际页面裁切待验收。

## 泰国、越南与马来西亚扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Koh Samui | 苏梅岛沙滩与棕榈树 | Ann Kolisnyk | [原图](https://unsplash.com/photos/palm-trees-line-a-sandy-beach-under-a-blue-sky-exkctPNzrtQ) · [许可](https://unsplash.com/license) |
| Krabi | 甲米莱利海滩与石灰岩山崖航拍 | Renato / Thaís | [原图](https://unsplash.com/photos/an-aerial-view-of-a-sandy-beach-surrounded-by-mountains-wEvFdxU7IL0) · [许可](https://unsplash.com/license) |
| Hue | 顺化皇城建筑 | Nguyen Minh | [原图](https://unsplash.com/photos/imperial-citadel-in-hue-vietnam-under-a-clear-sky-lzjlYsMGYXg) · [许可](https://unsplash.com/license) |
| Johor Bahru | 新山金海湾城市夜景 | Chan Yong Sheng | [原图](https://unsplash.com/photos/a-view-of-a-city-at-night-from-a-high-rise-building-7grn6LcHRjk) · [许可](https://unsplash.com/license) |
| Chiang Rai | 清莱白庙与水面倒影 | Rowan Heuvel | [原图](https://unsplash.com/photos/ornate-white-temple-reflected-in-calm-water-qGP71LpXtx4) · [许可](https://unsplash.com/license) |
| Pattaya | 芭堤雅海湾与城市全景 | Prashant | [原图](https://unsplash.com/photos/a-view-of-a-city-and-a-body-of-water-4FdJe2l3Y_s) · [许可](https://unsplash.com/license) |

USM 使用来源明确的苏梅岛海滩，不借用涛岛或帕岸岛；来源未指明海滩名称，不自行补充。KBV 为甲米莱利海滩，不沿用首张自动标题中的山湖描述。HUI 为顺化皇城，CEI 为清莱白庙，不与清迈混用。JHB 首张苏丹依斯干达清真寺为长竖幅俯拍，第二张 Jalan Ibrahim 公园仍为偏暗竖幅，最终选用来源明确的金海湾城市夜景。UTP 地点目录英文城市为 Pattaya、中文为乌塔保，实拍主体明确为芭堤雅海湾，非机场所在地街景。苏梅岛首张阴暗海滩改为较明亮的沙滩棕榈树画面，甲米首张行李前景改为莱利海滩航拍。当前浏览器关闭，实际页面裁切待验收。

## 美国主要城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Atlanta | 亚特兰大皮德蒙特公园眺望城市天际线与湖面倒影 | Michael Chambers | [原图](https://unsplash.com/photos/a-city-skyline-is-reflected-in-the-still-water-of-a-lake-trYq46s_SqY) · [许可](https://unsplash.com/license) |
| Phoenix | 凤凰城市中心天际线 | Nils Huenerfuerst | [原图](https://unsplash.com/photos/a-view-of-a-city-with-tall-buildings-RcDEbNQsjHU) · [许可](https://unsplash.com/license) |
| Minneapolis | 明尼阿波利斯石拱桥眺望城市夜景 | Federico Ramirez | [原图](https://unsplash.com/photos/a-view-of-a-city-at-night-from-a-bridge-NTV4vf-nIi0) · [许可](https://unsplash.com/license) |
| Nashville | 纳什维尔城市天际线、桥梁与河流 | Cameron Stewart | [原图](https://unsplash.com/photos/modern-city-skyline-with-a-bridge-over-a-river-lffBGK8H45I) · [许可](https://unsplash.com/license) |
| Charlotte | 从西侧眺望北卡罗来纳州夏洛特城市天际线 | Daniel Weiss | [原图](https://unsplash.com/photos/a-city-skyline-with-trees-x0P-6BRp5jc) · [许可](https://unsplash.com/license) |
| Detroit | 底特律蓝调暮色中的滨河天际线 | Venti Views | [原图](https://unsplash.com/photos/a-view-of-a-city-at-night-from-across-the-water-n4D4OcrNdr8) · [许可](https://unsplash.com/license) |

ATL 为皮德蒙特公园眺望亚特兰大天际线，BNA 为纳什维尔桥梁、河流与城市，MSP 为石拱桥眺望明尼阿波利斯夜景；来源未拍摄圣保罗，不标成圣保罗市区。CLT 明确为北卡罗来纳州夏洛特，不借用其他同名城市。底特律使用城市代码 DTT 并关联目录主要机场 DTW，未自动把 Willow Run 或旧城市机场加入。凤凰城首张城市主体较弱，第二张以工业街区为主，改用市中心天际线；夏洛特首张为竖幅，第二张偏暗，第三张天空占比过大，改用 Daniel Weiss 从西侧拍摄的城市天际线；底特律竖幅改为滨河蓝调横幅。MSP 1600px 版本高 698px，改下载 1900px 版本，不拉伸。当前浏览器关闭，实际页面裁切待验收。

## 阿尔及利亚、摩洛哥与南非扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Algiers | 阿尔及尔烈士纪念碑 | Halima Bouchouicha | [原图](https://unsplash.com/photos/a-tall-building-with-a-tower-ESkI6T_Ef5A) · [许可](https://unsplash.com/license) |
| Oran | 奥兰城市建筑俯瞰 | Soheib Mehdaoui | [原图](https://unsplash.com/photos/a-very-large-city-with-lots-of-tall-buildings-QWCCCfiywng) · [许可](https://unsplash.com/license) |
| Fez | 摩洛哥非斯老城全景 | Matt Dany | [原图](https://unsplash.com/photos/a-city-with-many-buildings-9FFvBUYmCKQ) · [许可](https://unsplash.com/license) |
| Tangier | 丹吉尔港湾、城市屋顶与远山 | Richard Vanlerberghe | [原图](https://unsplash.com/photos/coastal-city-with-harbor-and-distant-hills-under-cloudy-sky-cjJpIMIbtJU) · [许可](https://unsplash.com/license) |
| Durban | 德班北海滩城市天际线 | Weyland Swart | [原图](https://unsplash.com/photos/a-city-skyline-across-the-water-rfQwBKfG0xE) · [许可](https://unsplash.com/license) |
| Agadir | 阿加迪尔海滩日落 | Godefroy Boutet | [原图](https://unsplash.com/photos/the-sun-is-setting-over-the-ocean-on-a-beach-u_-90gvurB0) · [许可](https://unsplash.com/license) |

ALG 与 ORN 分别核对阿尔及尔、奥兰，不把其他阿尔及利亚城市或同名 Santa Cruz 地点照片借用。FEZ 为非斯老城全景，TNG 为丹吉尔港湾，DUR 为德班 North Beach，不使用开普敦或其他海岸替代。AGA 来源明确阿加迪尔海滩，不自行补充海滩名。城市与国家归属遵循地点目录，仅关联主要机场；未自动把奥兰 Tafaraoui 或德班 Virginia 入口加入。阿尔及尔首张城市暮色为竖幅，第二张港湾高 739px，最终选用 Halima Bouchouicha 的烈士纪念碑横幅。奥兰最终为城市建筑竖幅俯瞰，初步焦点位于建筑主体；阿加迪尔首张前景阴影明显，改为海岸日落竖幅，初步焦点位于太阳与海平线。当前浏览器关闭，实际页面裁切待验收。

## 国内旅行城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Lhasa | 拉萨布达拉宫侧景 | Wanghao SANG | [原图](https://unsplash.com/photos/a-large-white-and-red-building-on-top-of-a-hill-swzAUmQ8hFg) · [许可](https://unsplash.com/license) |
| Guilin | 桂林地区喀斯特群山与河流 | Ekaterina Zlotnikova | [原图](https://unsplash.com/photos/lush-green-karst-mountains-flank-a-winding-river-f_jBvzQIgig) · [许可](https://unsplash.com/license) |
| Lijiang | 丽江黑龙潭、桥梁与玉龙雪山远景 | Noppon Meenuch | [原图](https://unsplash.com/photos/a-lake-with-a-bridge-and-mountains-in-the-background-B7vuVxoMosc) · [许可](https://unsplash.com/license) |
| Urumqi | 乌鲁木齐国际大巴扎砖塔仰视 | Archcookie | [原图](https://unsplash.com/photos/a-tall-brick-tower-next-to-a-smaller-brick-tower-KhjYBzqmf_4) · [许可](https://unsplash.com/license) |
| Harbin | 哈尔滨教堂夜景 | Jason W | [原图](https://unsplash.com/photos/lighted-cathedral-during-night-time-QgSLNcB_a9M) · [许可](https://unsplash.com/license) |
| Dalian | 大连星海湾大桥暮色 | Wade Meng | [原图](https://unsplash.com/photos/xinghai-bridge-in-dalian-at-dusk-LgCj9qcrfhI) · [许可](https://unsplash.com/license) |

LXA 为布达拉宫侧景；KWL 来源明确为桂林地区喀斯特河流风景，未标成桂林市中心或擅自命名具体山峰。LJG 为丽江黑龙潭，首张竖幅建筑近景改为桥梁、湖面与远山。URC 最终来源明确为乌鲁木齐国际大巴扎砖塔仰视细节，不冒称城市全景；人民公园及大巴扎竖幅候选未采用，不借用喀什、伊斯坦布尔或新疆其他地区景观。HRB 为哈尔滨教堂夜景，原图以建筑细节为主；DLC 为大连星海湾大桥。机场按现有城市目录，仅关联主要机场，未自动添加哈尔滨平房入口。当前浏览器关闭，实际页面裁切待验收。

## 北欧、波兰与卢森堡扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Bergen | 卑尔根港湾与城市 | Niklas | [原图](https://unsplash.com/photos/a-body-of-water-with-a-bunch-of-boats-in-it-l-XeCold7E4) · [许可](https://unsplash.com/license) |
| Gothenburg | 哥德堡运河与城市建筑 | Hans Ott | [原图](https://unsplash.com/photos/a-boat-in-a-canal-in-front-of-a-large-building-with-schonbrunn-palace-in-the-background-xAJJYleAhPU) · [许可](https://unsplash.com/license) |
| Gdansk | 格但斯克老城滨河建筑 | Pix Tresa | [原图](https://unsplash.com/photos/historic-waterfront-buildings-along-a-river-under-blue-sky-jLeJ5UzoIKM) · [许可](https://unsplash.com/license) |
| Wroclaw | 弗罗茨瓦夫市场广场与新市政厅 | Anastasia Yaroshenko | [原图](https://unsplash.com/photos/a-large-building-with-flags-flying-in-front-of-it-VTjqI3WTY_s) · [许可](https://unsplash.com/license) |
| Luxembourg | 卢森堡城格伦德街区蓝调夜色 | Pierre Blaché | [原图](https://unsplash.com/photos/luxembourg-city-glows-at-night-Vb4qFOMfklI) · [许可](https://unsplash.com/license) |
| Aarhus | 奥胡斯 Møllestien 彩色房屋街景 | Julia Taubitz | [原图](https://unsplash.com/photos/colorful-historic-houses-line-a-cobblestone-street-Fb8tw8Jjs9M) · [许可](https://unsplash.com/license) |

BGO 为卑尔根港湾彩色屋群，来源、地点与原图一致；竖幅屋群集中在横向区域，初步焦点设于建筑与港湾。GOT 自动标题误提 Schönbrunn Palace，实际原图为瑞典银行标识、哥德堡电车及运河倒影，来源地点为 Gothenburg；主体只写哥德堡运河与城市建筑，不沿用错误宫殿名。GDN 为格但斯克滨河老城。WRO 比较新市政厅横幅与主广场旁哥特式教堂竖幅；后者钟楼贯穿整张图，不利于宽卡片保留主体，最终使用新市政厅横幅；AAR 首张现代港区改选 Møllestien 彩色街景；LUX 为卢森堡城 Grund 街区蓝调，不借用卢森堡境内其他城市。机场按现有地点目录，仅关联主要机场，未自动添加哥德堡旧 GSE 入口。当前浏览器关闭，实际页面裁切待验收。

## 意大利城市与海岛扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Palermo | 巴勒莫城市、海湾与山丘全景 | Christian Lue | [原图](https://unsplash.com/photos/panoramic-view-of-a-coastal-city-nestled-between-hills-tkuXhHi7cg0) · [许可](https://unsplash.com/license) |
| Catania | 卡塔尼亚主教堂广场 | Samir Kharrat | [原图](https://unsplash.com/photos/people-walking-near-beige-concrete-building-under-blue-sky-and-white-clouds-during-daytime-yhV1RqI4K50) · [许可](https://unsplash.com/license) |
| Verona | 维罗纳皮耶特拉桥与河岸建筑 | Henrique Ferreira | [原图](https://unsplash.com/photos/bridge-near-building-xTHJi7-tFWs) · [许可](https://unsplash.com/license) |
| Cagliari | 卡利亚里城市屋顶与海湾远景 | James Butterly | [原图](https://unsplash.com/photos/a-city-with-many-buildings-2hObLN6tkIA) · [许可](https://unsplash.com/license) |
| Olbia | 奥尔比亚海岸与植被航拍 | Katie Kalmykova | [原图](https://unsplash.com/photos/aerial-photography-of-green-trees-beside-seashore-Vq4bYMxT1Dg) · [许可](https://unsplash.com/license) |
| Bari | 巴里港湾、船只与城市建筑 | Maria Bobrova | [原图](https://unsplash.com/photos/blue-and-white-boats-on-sea-viewing-building-wNxEJbExriM) · [许可](https://unsplash.com/license) |

PMO 为巴勒莫城市、海湾与山丘，首张教堂塔楼为竖幅，另一个屋顶候选来源返回 404，未采用。CTA 为卡塔尼亚主教堂广场，不借用陶尔米纳；VRN 为皮耶特拉桥；CAG 为卡利亚里屋顶与海湾远景。OLB 航拍来源标注 Olbia 07026，主体只记录当地海岸与植被，不擅自命名海滩、不标成奥尔比亚市中心。BRI 为来源明确的巴里港湾，未借用 Polignano a Mare 海岸。仅关联现有主要机场，未自动添加维罗纳 VBS 入口。当前浏览器关闭，实际页面裁切待验收。

## 加勒比度假目的地扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Nassau | 拿骚海滩与浅蓝海水 | Frederick Wallace | [原图](https://unsplash.com/photos/a-beach-with-clear-blue-water-and-white-sand-DMakYjdTNKE) · [许可](https://unsplash.com/license) |
| Punta Cana | 蓬塔卡纳热带海滩与棕榈树航拍 | Miltiadis Fragkidis | [原图](https://unsplash.com/photos/tropical-beach-with-palm-trees-and-clear-turquoise-ocean-water-sG2cgXJHg3M) · [许可](https://unsplash.com/license) |
| Montego Bay | 蒙特哥贝海岸航拍 | Tyrone Sanders | [原图](https://unsplash.com/photos/an-aerial-view-of-a-city-NTuSXzly-lc) · [许可](https://unsplash.com/license) |
| Oranjestad | 阿鲁巴奥拉涅斯塔德 Royal Plaza 建筑 | Jamie Tudor | [原图](https://unsplash.com/photos/a-pink-and-white-building-with-a-palm-tree-in-front-of-it-9mdVy93KNgM) · [许可](https://unsplash.com/license) |
| Curacao | 库拉索威廉斯塔德彩色滨河建筑 | Bent Van Aeken | [原图](https://unsplash.com/photos/a-large-body-of-water-next-to-a-row-of-buildings-SHbQFX2zhWk) · [许可](https://unsplash.com/license) |
| Bridgetown | 布里奇敦彩色小屋 | Tom Jur | [原图](https://unsplash.com/photos/a-blue-building-with-a-purple-door-and-window-qGodnfzznW0) · [许可](https://unsplash.com/license) |

NAS 来源明确拿骚海岸，未借用埃克苏马、粉沙滩或其他巴哈马岛屿；首版 1600px 高 658px，改下载 2000px 全景。PUJ 首张棕榈树竖幅与 MBJ 度假楼竖幅均替换为各自来源明确的海岸航拍，不使用其他多米尼加或牙买加城市。AUA 为奥拉涅斯塔德 Royal Plaza 的粉色建筑细节，CUR 为威廉斯塔德彩色滨河建筑。BGI 为来源明确布里奇敦的彩色小屋，未将只标 Barbados 的其他海岸直接归为城区。每张主体按实际图像描述，不额外命名未经核实的海滩或度假酒店。仅关联现有主要机场，未自动添加拿骚 PID/WZY 入口。当前浏览器关闭，实际页面裁切待验收。

## 中美洲旅行目的地扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| San Salvador | 圣萨尔瓦多国家宫与前方广场 | Esaú Fuentes González | [原图](https://unsplash.com/photos/a-large-building-with-a-flag-in-front-of-it-L2v7-rEKeDI) · [许可](https://unsplash.com/license) |
| Roatan | 罗阿坦岛西湾海滩与近岸小船 | Chalo Garcia | [原图](https://unsplash.com/photos/a-sandy-beach-with-boats-in-the-water-fUKzRMTV9Xc) · [许可](https://unsplash.com/license) |
| Managua | 马那瓜建筑与旗帜 | Kohi | [原图](https://unsplash.com/photos/a-large-building-with-a-flag-on-top-of-it-EOgOeFCcpAU) · [许可](https://unsplash.com/license) |
| Guatemala City | 危地马拉城历史中心第六大道街景 | Soliman Cifuentes | [原图](https://unsplash.com/photos/a-crowd-of-people-walking-down-a-street-next-to-a-building-TzXj4JAnIWc) · [许可](https://unsplash.com/license) |
| Belize City | 伯利兹城运河与滨水街区 | Meritt Thomas | [原图](https://unsplash.com/photos/cars-parked-on-side-of-the-road-during-daytime-fz1ZxPkIISk) · [许可](https://unsplash.com/license) |
| Liberia | 利比里亚周边林孔德拉别哈国家公园火山喷气孔与森林 | Christian Hess Araya | [原图](https://unsplash.com/photos/green-trees-under-blue-sky-during-daytime-jNLPi2e1UDA) · [许可](https://unsplash.com/license) |

BZE 遗址候选未能核实具体遗址，改用来源明确伯利兹城的运河街区。GUA 国家文化宫候选前景遮挡较多，改用第六大道历史街区长曝光人流与建筑，不借用安提瓜。MGA 保留来源明确马那瓜的建筑与旗帜，不借用格拉纳达教堂。RTB 为罗阿坦岛 West Bay 海滩。LIR 明确为哥斯达黎加利比里亚周边林孔德拉别哈国家公园火山喷气孔与森林，不称为城区或瀑布。只关联现有主要机场。当前浏览器仍关闭，实际页面裁切待验收。

## 墨西哥旅行城市扩充（2026-11-04）

| 城市/目的地 | 主体 | 作者 | 来源与许可 |
| --- | --- | --- | --- |
| Guadalajara | 瓜达拉哈拉历史中心教堂与喷泉 | Wonderlane | [原图](https://unsplash.com/photos/a-large-cathedral-with-a-clock-on-the-front-of-it-wzWQ_D-5cTs) · [许可](https://unsplash.com/license) |
| Monterrey | 蒙特雷城市天际线与远山 | Steven Fernandez | [原图](https://unsplash.com/photos/an-aerial-view-of-a-city-with-mountains-in-the-background-ovmCoJVf0yg) · [许可](https://unsplash.com/license) |
| Merida | 梅里达蒙特霍大道历史建筑 | Sergio Mena Ferreira | [原图](https://unsplash.com/photos/white-building-with-yellow-accents-and-arched-entryway-W2QVrOBQgg8) · [许可](https://unsplash.com/license) |
| Puerto Vallarta | 巴亚尔塔港棕榈树与滨海步道 | Jeffrey Eisen | [原图](https://unsplash.com/photos/a-sunny-boardwalk-with-people-palm-trees-and-buildings--mDWD-fF21s) · [许可](https://unsplash.com/license) |
| Oaxaca | 瓦哈卡圣多明各德古斯曼教堂 | Sergio Mena Ferreira | [原图](https://unsplash.com/photos/a-large-cathedral-with-two-towers-under-a-cloudy-sky-ElgPl_7j9IE) · [许可](https://unsplash.com/license) |

GDL 来源明确瓜达拉哈拉历史中心，按实际画面记录教堂与喷泉，不沿用自动标题的主教堂称呼。MTY 为蒙特雷城市与山脉全景，不是美国 Monterey。MID 来源明确墨西哥尤卡坦梅里达蒙特霍大道，不借用西班牙同名城市。PVR 为巴亚尔塔港滨海步道，OAX 为瓦哈卡市圣多明各德古斯曼教堂。SJD 棕榈叶与墙面近景候选不够适合目的地卡片，未采用，仍待补；未将圣卢卡斯海角照片直接标为圣何塞德尔卡沃城区。只关联现有主要机场。当前浏览器仍关闭，实际页面裁切待验收。
