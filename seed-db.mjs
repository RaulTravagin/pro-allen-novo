import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

try {
  // Clear existing data
  await connection.execute('DELETE FROM routes');
  
  // Insert routes
  const routesData = [
    { name: 'Rota 1', region: 'Jordanesia / Campo Limpo' },
    { name: 'Rota 2', region: 'Jundiaí' },
    { name: 'Rota 3', region: 'Jundiaí' },
    { name: 'Rota 4', region: 'Jundiaí / Cabreúva' },
  ];

  const routeIds = {};
  for (const route of routesData) {
    const [result] = await connection.execute(
      'INSERT INTO routes (name, region) VALUES (?, ?)',
      [route.name, route.region]
    );
    routeIds[route.name] = result.insertId;
  }

  // Insert posts for Rota 1
  const postsRota1 = [
    { name: 'Kelvion', address: 'Jordanesia', region: 'Jordanesia', order: 1 },
    { name: 'Supertec', address: 'Campo Limpo', region: 'Campo Limpo', order: 2 },
    { name: 'Comtec 2', address: 'Campo Limpo', region: 'Campo Limpo', order: 3 },
  ];

  for (const post of postsRota1) {
    await connection.execute(
      'INSERT INTO posts (routeId, name, address, region, `order`) VALUES (?, ?, ?, ?, ?)',
      [routeIds['Rota 1'], post.name, post.address, post.region, post.order]
    );
  }

  // Insert posts for Rota 2
  const postsRota2 = [
    { name: 'Condominio esmeralda', address: 'Jundiaí', region: 'Jundiaí', order: 1 },
    { name: 'Caminhos da serra 1', address: 'Jundiaí', region: 'Jundiaí', order: 2 },
    { name: 'Caminhos da serra 2', address: 'Jundiaí', region: 'Jundiaí', order: 3 },
    { name: 'Instituto Luiz Braille', address: 'Jundiaí', region: 'Jundiaí', order: 4 },
    { name: 'Flex 1', address: 'Jundiaí', region: 'Jundiaí', order: 5 },
    { name: 'Flex 2', address: 'Jundiaí', region: 'Jundiaí', order: 6 },
    { name: 'Cidade vicentina', address: 'Jundiaí', region: 'Jundiaí', order: 7 },
    { name: 'Condomínio Tropical', address: 'Jundiaí', region: 'Jundiaí', order: 8 },
    { name: 'Auto posto Shell', address: 'Jundiaí', region: 'Jundiaí', order: 9 },
    { name: 'Galpão', address: 'Av. das Indústrias, 655', region: 'Jundiaí', order: 10 },
  ];

  for (const post of postsRota2) {
    await connection.execute(
      'INSERT INTO posts (routeId, name, address, region, `order`) VALUES (?, ?, ?, ?, ?)',
      [routeIds['Rota 2'], post.name, post.address, post.region, post.order]
    );
  }

  // Insert posts for Rota 3
  const postsRota3 = [
    { name: 'Open View', address: 'Jundiaí', region: 'Jundiaí', order: 1 },
    { name: 'Terras de Gênova', address: 'Jundiaí', region: 'Jundiaí', order: 2 },
    { name: 'Reserva da mata', address: 'Jundiaí', region: 'Jundiaí', order: 3 },
    { name: 'Metalurgica Saff', address: 'Jundiaí', region: 'Jundiaí', order: 4 },
    { name: 'C.M.A', address: 'Jundiaí', region: 'Jundiaí', order: 5 },
    { name: 'São Francisco', address: 'Jundiaí', region: 'Jundiaí', order: 6 },
  ];

  for (const post of postsRota3) {
    await connection.execute(
      'INSERT INTO posts (routeId, name, address, region, `order`) VALUES (?, ?, ?, ?, ?)',
      [routeIds['Rota 3'], post.name, post.address, post.region, post.order]
    );
  }

  // Insert posts for Rota 4
  const postsRota4 = [
    { name: 'Brasimet', address: 'Jundiaí', region: 'Jundiaí', order: 1 },
    { name: 'Bottcher', address: 'Jundiaí', region: 'Jundiaí', order: 2 },
    { name: 'Magnera', address: 'Jundiaí', region: 'Jundiaí', order: 3 },
    { name: 'G.A.G', address: 'Jundiaí', region: 'Jundiaí', order: 4 },
    { name: 'Eco Village', address: 'Jundiaí', region: 'Jundiaí', order: 5 },
    { name: 'C.P.Q', address: 'Jundiaí', region: 'Jundiaí', order: 6 },
    { name: 'Carmel', address: 'Cabreúva', region: 'Cabreúva', order: 7 },
  ];

  for (const post of postsRota4) {
    await connection.execute(
      'INSERT INTO posts (routeId, name, address, region, `order`) VALUES (?, ?, ?, ?, ?)',
      [routeIds['Rota 4'], post.name, post.address, post.region, post.order]
    );
  }

  console.log('✅ Database seeded successfully!');
  console.log(`✅ Created 4 routes with ${postsRota1.length + postsRota2.length + postsRota3.length + postsRota4.length} posts total`);
} catch (error) {
  console.error('❌ Error seeding database:', error);
  process.exit(1);
} finally {
  await connection.end();
}
