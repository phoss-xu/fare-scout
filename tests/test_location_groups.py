import unittest
from app import location_groups, locations


class GroupTests(unittest.TestCase):
    def test_every_group_only_returns_canonical_records(self):
        for menu in location_groups.menu():
            data=location_groups.group(menu['id'])
            self.assertTrue(data['sections'])
            for section in data['sections']:
                for row in section['locations']:
                    self.assertEqual(row,locations.resolve(row['id']))
        with self.assertRaises(ValueError): location_groups.group('missing')

    def test_mainland_and_regional_choices_include_distinct_scopes(self):
        mainland=location_groups.group('mainland')['sections'][0]['locations']
        self.assertTrue(all(row['country_code']=='CN' for row in mainland))
        greater=location_groups.group('greater-china')['sections']
        self.assertIn('city:HKG',[r['id'] for r in greater[0]['locations']])
        self.assertIn('country:FR',[r['id'] for r in location_groups.group('europe')['sections'][1]['locations']])

    def test_global_search_has_no_region_or_type_constraint(self):
        location_groups.group('europe')
        result=locations.search('香港国际机场')
        self.assertEqual(result[0]['id'],'airport:HKG')
        self.assertIn('city:HKG',[r['id'] for r in locations.search('香港')])

    def test_visa_group_is_passport_scoped_and_excludes_diplomatic_only_examples(self):
        data=location_groups.group('visa-free')
        self.assertEqual(data['passport'],'中国大陆普通护照')
        self.assertTrue(data['source'].startswith('https://cs.mfa.gov.cn/'))
        codes={r['code'] for r in data['sections'][0]['locations']}
        self.assertTrue({'TH','SG','MY'}.issubset(codes))
        self.assertTrue({'JP','US','FR','EC'}.isdisjoint(codes))


if __name__=='__main__': unittest.main()
