import axios from 'axios';
import config from '../config';

async function verifyDuplicates() {
  const baseURL = config.oak.apiBaseUrl;
  const apiKey = config.oak.apiKey;
  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
  };

  try {
    console.log('--- Verifying Tiered Content Differentiations ---');
    
    // 1. Get Subject details to find sequence
    const subjectRes = await axios.get(`${baseURL}/subjects/maths`, { headers });
    const subjectData = subjectRes.data.data || subjectRes.data;
    
    // Specifically find the secondary sequence
    const mathsSeq = subjectData.sequenceSlugs?.find((s: any) => 
      s.sequenceSlug.includes('secondary')
    );
    const slug = mathsSeq?.sequenceSlug || 'maths-secondary-aqa';

    console.log(`Checking sequence: ${slug}`);
    const unitsRes = await axios.get(`${baseURL}/sequences/${slug}/units`, { headers });
    const years = unitsRes.data.data || unitsRes.data || [];

    // Filter for Year 10/11 which should have tiers
    const tieredYear = years.find((y: any) => y.tiers && y.tiers.length > 0);
    
    if (tieredYear) {
      console.log(`\nFound Tiers in Year ${tieredYear.year}`);
      const tierMap: Record<string, any[]> = {};
      
      tieredYear.tiers.forEach((t: any) => {
        console.log(`- Tier: ${t.tierTitle} (${t.units?.length} units)`);
        tierMap[t.tierTitle] = t.units || [];
      });

      const foundation = tierMap['Foundation'] || [];
      const higher = tierMap['Higher'] || [];
      
      const common = foundation.filter(f => higher.some(h => h.unitSlug === f.unitSlug));
      
      if (common.length > 0) {
        const testSlug = common[0].unitSlug;
        console.log(`\nDuplicate Slug Found: ${testSlug}`);
        
        const fUnit = foundation.find(u => u.unitSlug === testSlug);
        const hUnit = higher.find(u => u.unitSlug === testSlug);
        
        console.log('\nFoundation Unit Object:', JSON.stringify(fUnit, null, 2));
        console.log('\nHigher Unit Object:', JSON.stringify(hUnit, null, 2));
      } else {
        console.log('\nNo common slugs found between tiers.');
      }
    } else {
      console.log('\nNo tiered year groups found.');
    }

  } catch (err: any) {
    console.error('Verify failed:', err.message);
  }
}

verifyDuplicates();
