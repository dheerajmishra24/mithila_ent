import AboutClient from './AboutClient';
import { getSiteContentMap } from '@/lib/content';

export default async function AboutPage() {
  const content = await getSiteContentMap();
  const intro = content['about_intro'] || { title: '', body: '' };
  return <AboutClient intro={{ title: intro.title, body: intro.body }} />;
}
