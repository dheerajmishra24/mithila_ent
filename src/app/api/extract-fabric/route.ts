import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const fabricSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: 'A luxurious, descriptive title for the fabric (e.g. Raw Indigo Heritage Handloom).' },
    description: { type: SchemaType.STRING, description: 'A highly descriptive paragraph emphasizing the tactile, structural, and premium quality of the fabric.' },
    weaveDensity: { type: SchemaType.STRING, description: 'The detected weave structure and density (e.g. 60s x 60s Handspun, 2/1 Twill).' },
    pigment: { type: SchemaType.STRING, description: 'The dye or pigment used (e.g. 100% Fermented Indigo Extract).' },
    gsm: { type: SchemaType.INTEGER, description: 'The estimated weight in grams per square meter (e.g. 150, 320).' },
    width: { type: SchemaType.STRING, description: 'The standard width (e.g. 54 inches / 137 cm).' },
    stretch: { type: SchemaType.STRING, description: 'The stretch factor (e.g. 0% Mechanical Stretch, 2% Elastane).' },
    origin: { type: SchemaType.STRING, description: 'The artisanal origin (e.g. Mithila Artisanal Cluster, India).' },
    bestSuitedFor: { type: SchemaType.STRING, description: 'Comma separated list of garments this is best suited for (e.g. Tailored overcoats, Unlined blazers).' },
    colors: { 
      type: SchemaType.ARRAY, 
      items: { type: SchemaType.STRING },
      description: 'A list of 2-4 descriptive color variants detected or suitable for the fabric.'
    }
  },
  required: ['title', 'description', 'weaveDensity', 'pigment', 'gsm', 'width', 'stretch', 'origin', 'bestSuitedFor', 'colors']
};

export async function POST(req: Request) {
  try {
    const { imageBase64, baseName } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: fabricSchema,
        temperature: 0.7,
      }
    });

    const prompt = `You are an expert textile engineer and luxury brand copywriter. 
    Analyze the provided fabric swatch image to determine its physical and visual characteristics.
    Base Name (if provided): ${baseName || 'None'}. 
    Extract the required technical specifications according to the schema. Ensure the title is elegant.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ]);

    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Gemini Extraction Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to extract fabric details' }, { status: 500 });
  }
}
