const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=== PDF Generator SaaS Test Suite ===\n');

  // Test 1: Health check / docs
  console.log('Test 1: GET /api/docs');
  const docs = await request('GET', '/api/docs');
  console.log(`  Status: ${docs.status}`);
  console.log(`  Has endpoints: ${docs.data.success && docs.data.data.endpoints.length > 0 ? 'PASS' : 'FAIL'}`);

  await delay(200);

  // Test 2: List templates (should have seeded data)
  console.log('\nTest 2: GET /api/templates (seeded data)');
  const list = await request('GET', '/api/templates');
  console.log(`  Status: ${list.status}`);
  console.log(`  Templates count >= 2: ${list.data.success && list.data.data.length >= 2 ? 'PASS' : 'FAIL'}`);

  const seededTemplate = list.data.data[0];
  console.log(`  First template: ${seededTemplate.name} (ID: ${seededTemplate.id})`);

  await delay(200);

  // Test 3: Get single template
  console.log('\nTest 3: GET /api/templates/:id');
  const getOne = await request('GET', `/api/templates/${seededTemplate.id}`);
  console.log(`  Status: ${getOne.status}`);
  console.log(`  Has html_content: ${getOne.data.success && getOne.data.data.html_content ? 'PASS' : 'FAIL'}`);

  await delay(200);

  // Test 4: Create template
  console.log('\nTest 4: POST /api/templates');
  const newTemplate = {
    name: 'Test Template',
    description: 'Created by test script',
    html_content: '<h1>Hello {{name}}</h1><p>{{message}}</p>',
    css_content: 'h1 { color: blue; }',
    sample_data: { name: 'World', message: 'This is a test' }
  };
  const created = await request('POST', '/api/templates', newTemplate);
  console.log(`  Status: ${created.status}`);
  console.log(`  Created successfully: ${created.data.success ? 'PASS' : 'FAIL'}`);

  const createdId = created.data.data.id;

  await delay(200);

  // Test 5: Update template
  console.log('\nTest 5: PUT /api/templates/:id');
  const updateRes = await request('PUT', `/api/templates/${createdId}`, {
    name: 'Updated Test Template'
  });
  console.log(`  Status: ${updateRes.status}`);
  console.log(`  Updated name: ${updateRes.data.success && updateRes.data.data.name === 'Updated Test Template' ? 'PASS' : 'FAIL'}`);

  await delay(200);

  // Test 6: Generate PDF (binary response)
  console.log('\nTest 6: POST /api/generate-pdf');
  const pdfRes = await request('POST', '/api/generate-pdf', {
    template_id: seededTemplate.id,
    data: { company_name: 'Test Corp', customer_name: 'Alice' }
  });
  console.log(`  Status: ${pdfRes.status}`);
  console.log(`  Content-Type is PDF: ${pdfRes.headers['content-type'] === 'application/pdf' ? 'PASS' : 'FAIL'}`);
  console.log(`  Has content: ${pdfRes.data && pdfRes.data.length > 100 ? 'PASS' : 'FAIL'}`);

  await delay(200);

  // Test 7: Generate PDF to file
  console.log('\nTest 7: POST /api/generate-pdf-file');
  const fileRes = await request('POST', '/api/generate-pdf-file', {
    template_id: seededTemplate.id,
    data: { company_name: 'Test Corp', customer_name: 'Bob' }
  });
  console.log(`  Status: ${fileRes.status}`);
  console.log(`  Has download_url: ${fileRes.data.success && fileRes.data.data.download_url ? 'PASS' : 'FAIL'}`);

  if (fileRes.data.success) {
    const filename = fileRes.data.data.filename;
    const filePath = path.join(__dirname, 'uploads', filename);
    const exists = fs.existsSync(filePath);
    console.log(`  File exists on disk: ${exists ? 'PASS' : 'FAIL'} (${filePath})`);
    if (exists) {
      const stats = fs.statSync(filePath);
      console.log(`  File size: ${stats.size} bytes`);
    }
  }

  await delay(200);

  // Test 8: Delete template
  console.log('\nTest 8: DELETE /api/templates/:id');
  const delRes = await request('DELETE', `/api/templates/${createdId}`);
  console.log(`  Status: ${delRes.status}`);
  console.log(`  Deleted: ${delRes.data.success ? 'PASS' : 'FAIL'}`);

  await delay(200);

  // Test 9: Verify deletion
  console.log('\nTest 9: Verify deleted template');
  const verifyRes = await request('GET', `/api/templates/${createdId}`);
  console.log(`  Status: ${verifyRes.status}`);
  console.log(`  Returns 404: ${verifyRes.status === 404 ? 'PASS' : 'FAIL'}`);

  await delay(200);

  // Test 10: Error handling - invalid template_id
  console.log('\nTest 10: Error handling - invalid template_id');
  const errRes = await request('POST', '/api/generate-pdf', {
    template_id: 99999,
    data: {}
  });
  console.log(`  Status: ${errRes.status}`);
  console.log(`  Returns 404: ${errRes.status === 404 ? 'PASS' : 'FAIL'}`);

  console.log('\n=== Test Suite Complete ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
