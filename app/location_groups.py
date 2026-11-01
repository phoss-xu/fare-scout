"""Editorial discovery groups; canonical typed locations remain the selection values."""
from . import locations

# City lists are curated starting points, not rankings inferred from traffic or fares.
GROUPS = [
    ('global','全球热门','HKG TYO OSA SEL BKK SIN KUL DPS LON PAR ROM NYC LAX SYD DXB',''),
    ('mainland','内地热门','SHA BJS CAN SZX CTU CKG SIA HGH KMG SYX XMN TAO CSX WUH','CN'),
    ('greater-china','港澳台','HKG MFM TPE KHH','HK MO TW'),
    ('europe','欧洲','LON PAR ROM BCN AMS FRA MUC ZRH VIE PRG','GB FR DE IT ES PT NL BE LU IE CH AT CZ PL HU GR DK SE NO FI IS EE LV LT SK SI HR BA RS ME MK AL BG RO MD UA BY RU TR MT CY AD MC SM LI'),
    ('visa-free','免签','',''),
    ('north-america','北美','NYC LAX SFO YVR YTO YMQ MEX','US CA MX GT BZ HN SV NI CR PA CU JM HT DO BS BB TT AG DM GD KN LC VC'),
    ('south-america','南美','SAO RIO BUE LIM SCL BOG','BR AR CL PE CO EC UY PY BO VE GY SR'),
    ('east-asia','东亚','TYO OSA SEL PUS HKG TPE SHA BJS','CN JP KR KP MN HK MO TW'),
    ('southeast-asia','东南亚','BKK HKT SIN KUL DPS SGN HAN MNL','TH SG MY ID VN PH KH LA MM BN TL'),
    ('oceania','大洋洲','SYD MEL AKL BNE PER','AU NZ FJ PG SB VU WS TO TV KI NR FM MH PW'),
    ('middle-east','中东','DXB DOH IST AUH','AE QA SA OM BH KW TR IL JO LB IQ IR YE SY'),
    ('africa','非洲','CAI CPT JNB NBO MRU','EG MA TN DZ ZA KE TZ MU SC ET NG GH SN RW UG ZM ZW NA BW MZ MG'),
]
VISA_SOURCE='https://cs.mfa.gov.cn/zggmcgx/cgqzapecswlxk/ylb/202607/t20260716_11984014.html'
VISA_CODES='TH SG MY AE QA GE RS KZ MV MU SC FJ AL BA AM UZ'


def menu():
    return [{'id':identity,'label':label} for identity,label,_,_ in GROUPS]


def records(kind, codes):
    return [locations.resolve(f'{kind}:{code}') for code in codes.split()]


def group(identity):
    row=next((row for row in GROUPS if row[0]==identity),None)
    if not row:
        raise ValueError('没有找到这个地区分类，请重新选择。')
    identity,label,cities,countries=row
    note='热门为编辑精选，供浏览起点参考，并非实时热度排名。分类不会限制上方的全局搜索。'
    sections=[]
    if identity=='visa-free':
        return {'id':identity,'label':label,'passport':'中国大陆普通护照','checked_at':'2026-11-01',
                'source':VISA_SOURCE,'note':'以下为中国大陆普通护照短期旅行互免签证精选，并非全部免签目的地。仍须核对停留期限、旅行目的、入境材料及中转要求；其他护照不适用此分类。',
                'sections':[{'label':'普通护照互免签证精选','locations':records('country',VISA_CODES)}]}
    if cities:
        sections.append({'label':'热门城市','locations':records('city',cities)})
    if countries:
        sections.append({'label':'按国家 / 地区选择','locations':records('country',countries)})
    return {'id':identity,'label':label,'note':note,'sections':sections}
