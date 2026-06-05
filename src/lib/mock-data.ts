export const MOCK_VARIANTS = [
  {
    id: 'mock-1',
    color: 'Crimson Red',
    price: 1200,
    stock_quantity: 10,
    images: ['/images/fabrics/cotton.png'],
    product_id: 'prod-1',
    products: {
      id: 'prod-1',
      title: 'Hand-spun Cotton Tunic',
      slug: 'hand-spun-cotton-tunic',
      description: 'Premium hand-spun cotton tunic featuring intricate Jamdani weave patterns. Perfect for casual or semi-formal wear with deep crimson hues naturally dyed from botanical sources.',
      weave: 'Jamdani',
      gsm: 150,
      is_featured: true,
      tags: ['cotton', 'stitched'],
      categories: { name: 'Stitched Wear' }
    }
  },
  {
    id: 'mock-2',
    color: 'Natural Ecru',
    price: 850,
    stock_quantity: 25,
    images: ['/images/fabrics/viscose.png'],
    product_id: 'prod-2',
    products: {
      id: 'prod-2',
      title: 'Raw Silk Yardage',
      slug: 'raw-silk-yardage',
      description: 'Pure, unbleached Tussar silk yardage. Loomed by heritage artisans, this fabric showcases the raw, natural elegance and texture of organic silk. Sold per meter.',
      weave: 'Tussar',
      gsm: 120,
      is_featured: false,
      tags: ['silk'],
      categories: { name: 'Fabric' }
    }
  },
  {
    id: 'mock-3',
    color: 'Indigo Blue',
    price: 1450,
    stock_quantity: 5,
    images: ['/images/fabrics/linen.png'],
    product_id: 'prod-3',
    products: {
      id: 'prod-3',
      title: 'Botanical Dyed Linen',
      slug: 'botanical-dyed-linen',
      description: 'Highly breathable linen, dyed using fermented indigo plants. This plain weave fabric offers superior comfort and gets softer with every wash.',
      weave: 'Plain',
      gsm: 180,
      is_featured: true,
      tags: ['linen'],
      categories: { name: 'Fabric' }
    }
  },
  {
    id: 'mock-4',
    color: 'Turmeric Yellow',
    price: 950,
    stock_quantity: 40,
    images: ['/images/fabrics/wool.png'],
    product_id: 'prod-4',
    products: {
      id: 'prod-4',
      title: 'Organic Cotton Weave',
      slug: 'organic-cotton-weave',
      description: 'GOTS certified organic cotton woven in a soft satin finish. Naturally dyed with turmeric roots, this fabric offers a vibrant, sunshine glow.',
      weave: 'Satin',
      gsm: 160,
      is_featured: false,
      tags: ['cotton'],
      categories: { name: 'Fabric' }
    }
  },
  {
    id: 'mock-5',
    color: 'Forest Green',
    price: 1100,
    stock_quantity: 15,
    images: ['/images/fabrics/velvet.png'],
    product_id: 'prod-5',
    products: {
      id: 'prod-5',
      title: 'Heritage Madhubani Silk',
      slug: 'heritage-madhubani-silk',
      description: 'A luxurious Jacquard weave silk featuring subtle motifs inspired by ancient Madhubani art. Perfect for ceremonial dresses or premium home decor.',
      weave: 'Jacquard',
      gsm: 130,
      is_featured: true,
      tags: ['silk'],
      categories: { name: 'Fabric' }
    }
  },
  {
    id: 'mock-6',
    color: 'Charcoal Black',
    price: 1600,
    stock_quantity: 8,
    images: ['/images/fabrics/suede.png'],
    product_id: 'prod-6',
    products: {
      id: 'prod-6',
      title: 'Linen Saree Drape',
      slug: 'linen-saree-drape',
      description: 'A full 6-yard linen saree drape with intricate Jamdani borders. Lightweight, elegant, and timeless. Features a deep charcoal hue derived from natural ink.',
      weave: 'Jamdani',
      gsm: 140,
      is_featured: false,
      tags: ['linen', 'saree'],
      categories: { name: 'Saree' }
    }
  },
  {
    id: 'mock-7',
    color: 'Terracotta Orange',
    price: 890,
    stock_quantity: 50,
    images: ['/images/fabrics/corduroy.png'],
    product_id: 'prod-7',
    products: {
      id: 'prod-7',
      title: 'Artisan Loomed Cotton',
      slug: 'artisan-loomed-cotton',
      description: 'A sturdy, plain weave cotton loomed by master artisans. Highly versatile and durable, making it an excellent choice for upholstery or heavy garments.',
      weave: 'Plain',
      gsm: 220,
      is_featured: false,
      tags: ['cotton'],
      categories: { name: 'Fabric' }
    }
  },
  {
    id: 'mock-8',
    color: 'Pearl White',
    price: 2100,
    stock_quantity: 3,
    images: ['/images/fabrics/twill.png'],
    product_id: 'prod-8',
    products: {
      id: 'prod-8',
      title: 'Premium Handwoven Tunic',
      slug: 'premium-handwoven-tunic',
      description: 'Our most premium stitched offering. This tunic features a crisp twill weave using the finest hand-selected cotton fibers, offering unmatched breathability and a sleek, modern fit.',
      weave: 'Twill',
      gsm: 170,
      is_featured: true,
      tags: ['cotton', 'stitched'],
      categories: { name: 'Stitched Wear' }
    }
  }
];

export const MOCK_PRODUCTS = MOCK_VARIANTS.map(v => ({
  ...v.products,
  product_variants: [
    {
      id: v.id,
      color: v.color,
      price: v.price,
      stock_quantity: v.stock_quantity,
      images: v.images
    }
  ]
}));
