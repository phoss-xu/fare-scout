"""Download the curated, source-checked Unsplash city thumbnails used by map cards."""
import json
import urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / 'app/static'
PHOTOS = {
    'DAD': ('Da Nang','Khoi Tran','nAanDX0XMHQ','photo-1662138871716-c45b1f1583f2'),
    'KHH': ('Kaohsiung','Johnson Hung','yCXuiHfJQXI','photo-1729347402512-0ef428731e36'),
    'HAN': ('Hanoi','Quang Nguyen Vinh','tGcIGuJMO4s','photo-1676557058640-ac6ed13a68de'),
}
def entry(city,author,source,path):
    return dict(city=city,author=author,source=source,path=path,license='Unsplash License',
                license_url='https://unsplash.com/license',downloaded='2026-11-03')
def main():
    directory=ROOT/'assets/destinations';directory.mkdir(exist_ok=True)
    catalog={}
    for code,(city,author,photo_id,cdn_id) in PHOTOS.items():
        url=f'https://images.unsplash.com/{cdn_id}?auto=format&fit=crop&fm=jpg&w=480&q=82'
        request=urllib.request.Request(url,headers={'User-Agent':'FareScoutLocalPreview/1.0'})
        with urllib.request.urlopen(request,timeout=30) as response:
            if response.headers.get_content_type()!='image/jpeg':
                raise ValueError('Unexpected photo format for '+code)
            data=response.read()
        (directory/f'{code}.jpg').write_bytes(data)
        catalog[code]=entry(city,author,f'https://unsplash.com/photos/{photo_id}',f'/assets/destinations/{code}.jpg')
        print(code,len(data),flush=True)
    for codes,city,author,photo_id,filename in [
        (['HKG'],'Hong Kong','Henry Lai','PM8uNu5RTIw','harbour'),
        (['SIN'],'Singapore','Zhu Hongzhi','EtjLtPUbqbs','sculpture'),
        (['HND','NRT'],'Tokyo','Marek Okon','2m6wr8qMiio','city'),
        (['DPS'],'Bali','Armand Mckenzie','oR9jNPOKlU8','rice')]:
        for code in codes:catalog[code]=entry(city,author,f'https://unsplash.com/photos/{photo_id}',f'/assets/places/{filename}.thumb.jpg')
    (ROOT/'destination-photos.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
