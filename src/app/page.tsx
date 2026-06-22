import HomeClient from './HomeClient';
import { getSiteContentMap, getLatestVariants } from '@/lib/content';

export default async function HomePage() {
  const content = await getSiteContentMap();
  const hero = content['home_hero'] || { title: '', body: '' };
  const latest = await getLatestVariants();
  return <HomeClient hero={{ title: hero.title, body: hero.body }} latest={latest} />;
}
