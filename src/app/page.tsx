import HomeClient from './HomeClient';
import { getSiteContentMap, getLatestVariants } from '@/lib/content';

export default async function HomePage() {
  const content = await getSiteContentMap();
  const hero = content['home_hero'] || { title: '', body: '' };
  const features = content['home_features'] || { title: '', body: '' };
  const cta = content['home_cta'] || { title: '', body: '' };
  const latest = await getLatestVariants();
  return <HomeClient 
    hero={{ title: hero.title, body: hero.body }} 
    features={{ title: features.title, body: features.body }} 
    cta={{ title: cta.title, body: cta.body }} 
    latest={latest} 
  />;
}
