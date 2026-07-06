import AboutClient from './AboutClient';
import { getSiteContentMap } from '@/lib/content';

export default async function AboutPage() {
  const content = await getSiteContentMap();
  const intro = content['about_intro'] || { title: '', body: '' };
  const mission = content['about_mission'] || { title: '', body: '' };
  const heritage = content['about_heritage'] || { title: '', body: '' };
  return <AboutClient 
    intro={{ title: intro.title, body: intro.body }} 
    mission={{ title: mission.title, body: mission.body }} 
    heritage={{ title: heritage.title, body: heritage.body }} 
  />;
}
