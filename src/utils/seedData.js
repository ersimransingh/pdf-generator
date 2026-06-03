const TemplateModel = require('../models/templateModel');
const logger = require('./logger');

const invoiceTemplate = {
  name: 'Invoice',
  description: 'Professional invoice template with itemized billing using {{#each}} loops',
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice {{invoice_number}}</title>
</head>
<body>
  <div class="invoice-container">
    <header class="invoice-header">
      <div class="company">
        <h1>{{company_name}}</h1>
        <p>{{company_address}}</p>
        <p>Email: {{company_email}}</p>
      </div>
      <div class="invoice-meta">
        <h2>INVOICE</h2>
        <p><strong>Invoice #:</strong> {{invoice_number}}</p>
        <p><strong>Date:</strong> {{invoice_date}}</p>
        <p><strong>Due Date:</strong> {{due_date}}</p>
      </div>
    </header>

    <section class="bill-to">
      <h3>Bill To:</h3>
      <p><strong>{{customer_name}}</strong></p>
      <p>{{customer_address}}</p>
      <p>{{customer_email}}</p>
    </section>

    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>{{@index}}</td>
          <td>{{description}}</td>
          <td>{{quantity}}</td>
          <td>{{unit_price}}</td>
          <td>{{amount}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>Subtotal:</span><span>{{subtotal}}</span></div>
      <div class="total-row"><span>Tax ({{tax_percent}}%):</span><span>{{tax_amount}}</span></div>
      <div class="total-row grand"><span>Total:</span><span>{{total}}</span></div>
    </div>

    {{#if notes}}
    <div class="notes">
      <h3>Notes:</h3>
      <p>{{notes}}</p>
    </div>
    {{/if}}

    <footer class="invoice-footer">
      <p>Thank you for your business!</p>
    </footer>
  </div>
</body>
</html>`,
  css_content: `@page {
  size: A4;
  margin: 30px;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #333;
  line-height: 1.5;
  margin: 0;
  padding: 0;
}

.invoice-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 3px solid #2563eb;
  padding-bottom: 20px;
  margin-bottom: 30px;
}

.company h1 {
  margin: 0 0 10px 0;
  color: #2563eb;
  font-size: 28px;
}

.company p {
  margin: 2px 0;
  color: #666;
}

.invoice-meta {
  text-align: right;
}

.invoice-meta h2 {
  margin: 0 0 10px 0;
  color: #2563eb;
  font-size: 24px;
}

.invoice-meta p {
  margin: 4px 0;
}

.bill-to {
  margin-bottom: 30px;
}

.bill-to h3 {
  margin: 0 0 10px 0;
  color: #444;
  border-bottom: 1px solid #ddd;
  padding-bottom: 5px;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
}

.items-table th,
.items-table td {
  border: 1px solid #ddd;
  padding: 12px;
  text-align: left;
}

.items-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #444;
}

.items-table tr:nth-child(even) {
  background: #f8fafc;
}

.totals {
  width: 300px;
  margin-left: auto;
  margin-bottom: 30px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.total-row.grand {
  font-size: 18px;
  font-weight: bold;
  border-top: 2px solid #2563eb;
  border-bottom: none;
  color: #2563eb;
  padding-top: 12px;
}

.notes {
  margin-bottom: 30px;
  padding: 15px;
  background: #f8fafc;
  border-radius: 6px;
}

.notes h3 {
  margin: 0 0 8px 0;
  color: #444;
}

.invoice-footer {
  text-align: center;
  color: #666;
  font-size: 14px;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}`,
  sample_data: JSON.stringify({
    company_name: 'Acme Corp',
    company_address: '123 Business Ave, Suite 100\nNew York, NY 10001',
    company_email: 'billing@acmecorp.com',
    invoice_number: 'INV-2024-001',
    invoice_date: '2024-03-15',
    due_date: '2024-04-15',
    customer_name: 'John Doe',
    customer_address: '456 Client St\nLos Angeles, CA 90001',
    customer_email: 'john@example.com',
    items: [
      { description: 'Web Design Services', quantity: 10, unit_price: '$75.00', amount: '$750.00' },
      { description: 'Hosting (Annual)', quantity: 1, unit_price: '$120.00', amount: '$120.00' },
      { description: 'Domain Registration', quantity: 1, unit_price: '$15.00', amount: '$15.00' }
    ],
    subtotal: '$885.00',
    tax_percent: 10,
    tax_amount: '$88.50',
    total: '$973.50',
    notes: 'Payment due within 30 days. Please include invoice number with payment.'
  })
};

const certificateTemplate = {
  name: 'Certificate',
  description: 'Elegant certificate of completion with decorative borders',
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Certificate of Completion</title>
</head>
<body>
  <div class="certificate">
    <div class="border-outer">
      <div class="border-inner">
        <div class="certificate-content">
          <div class="header">
            <h1>Certificate</h1>
            <h2>of Completion</h2>
          </div>

          <p class="presented-text">This certificate is proudly presented to</p>

          <h3 class="recipient">{{recipient_name}}</h3>

          <p class="course-text">For successfully completing the course</p>

          <h4 class="course-name">{{course_name}}</h4>

          <p class="date-text">On this date: <strong>{{completion_date}}</strong></p>

          {{#if score}}
          <p class="score-text">With a score of <strong>{{score}}%</strong></p>
          {{/if}}

          <div class="signatures">
            <div class="signature">
              <div class="line"></div>
              <p>{{instructor_name}}</p>
              <span>Instructor</span>
            </div>
            <div class="signature">
              <div class="line"></div>
              <p>{{director_name}}</p>
              <span>Director</span>
            </div>
          </div>

          <div class="seal">&#9733;</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`,
  css_content: `@page {
  size: A4 landscape;
  margin: 20px;
}

body {
  font-family: 'Georgia', 'Times New Roman', serif;
  margin: 0;
  padding: 0;
  background: #fff;
}

.certificate {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.border-outer {
  width: 100%;
  max-width: 900px;
  border: 8px solid #1e3a5f;
  padding: 8px;
}

.border-inner {
  border: 4px solid #c9a227;
  padding: 8px;
}

.certificate-content {
  border: 2px solid #1e3a5f;
  padding: 50px 60px;
  text-align: center;
  position: relative;
  min-height: 500px;
}

.header h1 {
  font-size: 48px;
  color: #1e3a5f;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 8px;
}

.header h2 {
  font-size: 24px;
  color: #c9a227;
  margin: 10px 0 40px 0;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 4px;
}

.presented-text {
  font-size: 18px;
  color: #555;
  margin-bottom: 20px;
}

.recipient {
  font-size: 42px;
  color: #1e3a5f;
  margin: 20px 0;
  font-style: italic;
  border-bottom: 2px solid #c9a227;
  display: inline-block;
  padding: 0 40px 10px 40px;
}

.course-text {
  font-size: 16px;
  color: #555;
  margin: 30px 0 10px 0;
}

.course-name {
  font-size: 28px;
  color: #1e3a5f;
  margin: 10px 0 30px 0;
}

.date-text,
.score-text {
  font-size: 16px;
  color: #555;
  margin: 10px 0;
}

.signatures {
  display: flex;
  justify-content: space-around;
  margin-top: 60px;
  padding: 0 40px;
}

.signature {
  text-align: center;
  width: 200px;
}

.signature .line {
  border-bottom: 1px solid #333;
  margin-bottom: 8px;
  height: 30px;
}

.signature p {
  margin: 0;
  font-size: 16px;
  color: #1e3a5f;
  font-weight: bold;
}

.signature span {
  font-size: 14px;
  color: #666;
}

.seal {
  position: absolute;
  bottom: 30px;
  right: 40px;
  width: 80px;
  height: 80px;
  background: #c9a227;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: #fff;
  transform: rotate(-15deg);
  opacity: 0.9;
}`,
  sample_data: JSON.stringify({
    recipient_name: 'Jane Smith',
    course_name: 'Advanced Web Development',
    completion_date: 'March 15, 2024',
    score: '95',
    instructor_name: 'Dr. Alan Turing',
    director_name: 'Grace Hopper'
  })
};

const sanctionLetterTemplate = {
  name: 'Sanction Letter',
  description: 'Loan sanction letter with Key Facts Statement, Annexures and Terms & Conditions',
  header_html: `<div style="font-size: 9px; width: 100%; text-align: center; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
  <span style="float: left;">Quince Capital</span>
  <span style="float: right;">Confidential</span>
  <div style="clear: both;"></div>
</div>`,
  footer_html: `<div style="font-size: 8px; width: 100%; text-align: center; color: #888; border-top: 1px solid #ddd; padding-top: 4px;">
  Page <span class="pageNumber"></span> of <span class="totalPages"></span>
</div>`,
  watermark_text: 'DRAFT',
  watermark_enabled: 0,
  watermark_options: JSON.stringify({ opacity: 0.08, color: '#000000', fontSize: '100px', angle: -45 }),
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sanction Letter - {{application_number}}</title>
</head>
<body>
  <!-- Page 1: Cover Letter -->
  <div class="page cover-page">
    <div class="letter-date">{{letter_date}}</div>

    <div class="addressee">
      <p><strong>{{applicant_first_name}} {{applicant_last_name}}</strong></p>
      <p>{{applicant_address_line1}},</p>
      <p>{{applicant_address_line2}},</p>
      <p>{{city}} - {{pincode}}</p>
      <p>{{state}}</p>
      <p>Contact Number: {{contact_number}}</p>
    </div>

    <div class="app-meta">
      <p><strong>Application Number:</strong> {{application_number}}</p>
      <p><strong>Co-Applicant Name:</strong> {{co_applicant_first_name}} {{co_applicant_last_name}}</p>
    </div>

    <div class="hero">
      <h1>All set. It's sanctioned.</h1>
    </div>

    <div class="salutation">
      <p>Dear {{applicant_first_name}} {{applicant_middle_name}} {{applicant_last_name}},</p>
    </div>

    <div class="body-text">
      <p>Kudos! Your loan has been sanctioned.</p>
      <p>The details are shared below.</p>
    </div>

    <table class="summary-table">
      <thead>
        <tr>
          <th>Type of Loan Facility</th>
          <th>Loan Amount (&#8377;)</th>
          <th>Rate of Interest</th>
          <th>EMI (Rs)</th>
          <th>Tenure (Months)</th>
          <th>PEMI/EMI Due Date</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{{loan_type}}</td>
          <td>{{loan_amount}}/-</td>
          <td>{{interest_rate}}%</td>
          <td>{{emi_amount}}/-</td>
          <td>{{tenure_months}}</td>
          <td>{{emi_due_date}}</td>
        </tr>
      </tbody>
    </table>

    <div class="body-text">
      <p>Please go through them carefully along with the General Terms &amp; Conditions (GTC) and the loan and security documents shared with you.</p>
      <p>A few more steps and we'll take this ahead.</p>
      <p>For any clarification, don't hesitate to contact your Branch Manager, <strong>{{branch_manager_first_name}} {{branch_manager_last_name}}</strong>, at +91 {{branch_manager_contact}}.</p>
      <p>You can also mail us at hello@quincecapital.in or call us at +91 1800 210 7990.</p>
    </div>

    <div class="closing">
      <p>Always there to assist you,</p>
      <p><strong>Customer Service Team</strong></p>
    </div>

    <div class="divider"></div>

    <div class="footer-note">
      <p>Quince Capital is the Brand Name of Satyam Finlease Pvt Ltd | CIN: U74899DL1994PTC063887 | www.quincecapital.in</p>
      <p>Corporate Office: 11th Floor, R-Square, Andheri Kurla Road, Hanuman Nagar, Andheri East, Mumbai - 400 093</p>
      <p>Registered Office: 107-A, Shivlok House, Karampura Commercial Complex, New Delhi - 110 015 | Call: +91 1800 210 7990</p>
    </div>
  </div>

  <!-- Page 2: Key Facts Statement Part 1 -->
  <div class="page">
    <h2 class="section-title">SANCTION LETTER CUM KEY FACTS STATEMENT</h2>

    <table class="kfs-table">
      <tbody>
        <tr>
          <td class="num">1</td>
          <td class="label">Loan application number and date</td>
          <td class="value">{{application_number}} dated {{letter_date}}</td>
        </tr>
        <tr>
          <td class="num">2</td>
          <td class="label">Borrower</td>
          <td class="value">
            Name: {{borrower_name}} | Age: {{borrower_age}} yrs<br>
            Address: {{borrower_address}}<br>
            PAN No: {{borrower_pan}}<br>
            Mobile no: {{borrower_mobile}}<br>
            Email id: {{borrower_email}}
          </td>
        </tr>
        <tr>
          <td class="num">3</td>
          <td class="label">Co-Borrower(s)<br><small>The obligations of the Borrower and Co-Borrower are joint and several.</small></td>
          <td class="value">
            Name: {{co_borrower_name}} | Age: {{co_borrower_age}} yrs<br>
            Address: {{co_borrower_address}}<br>
            PAN No: {{co_borrower_pan}}<br>
            Mobile no: {{co_borrower_mobile}}<br>
            Email id: {{co_borrower_email}}
          </td>
        </tr>
        <tr>
          <td class="num">4</td>
          <td class="label">Guarantor(s) (If applicable)</td>
          <td class="value">
            Name: {{guarantor_name}} | Age: {{guarantor_age}} yrs<br>
            Address: {{guarantor_address}}<br>
            PAN No: {{guarantor_pan}}<br>
            Mobile no: {{guarantor_mobile}}<br>
            Email id: {{guarantor_email}}
          </td>
        </tr>
        <tr>
          <td class="num">5</td>
          <td class="label">Nature of facility</td>
          <td class="value">{{loan_type}}</td>
        </tr>
        <tr>
          <td class="num">6</td>
          <td class="label">Product</td>
          <td class="value">{{product_name}}</td>
        </tr>
        <tr>
          <td class="num">7</td>
          <td class="label">Loan amount sanctioned</td>
          <td class="value">(&#8377;) {{loan_amount}}/- (Rupees: {{loan_amount_in_words}} Only)</td>
        </tr>
        <tr>
          <td class="num">8</td>
          <td class="label">Purpose of Loan</td>
          <td class="value">{{loan_purpose}}</td>
        </tr>
        <tr>
          <td class="num">9</td>
          <td class="label">Proposed Disbursement Schedule</td>
          <td class="value">
            First Tranche: INR {{first_tranche_amount}}/- (Rupees: {{first_tranche_in_words}} only)<br>
            Final Tranche: INR {{final_tranche_amount}}/- (Rupees: {{final_tranche_in_words}} only)
          </td>
        </tr>
        <tr>
          <td class="num">10</td>
          <td class="label">Tenor</td>
          <td class="value">{{tenure_months}} Months ({{tenure_years}} Years)</td>
        </tr>
        <tr>
          <td class="num">11</td>
          <td class="label">Repayment</td>
          <td class="value">Instalment payable as per repayment frequency</td>
        </tr>
        <tr>
          <td class="num">12</td>
          <td class="label">Repayment Schedule</td>
          <td class="value">
            i. Loan shall be repaid by way of {{repayment_emi_count}} EMIs starting from following the month of final disbursement.<br>
            ii. Pre-EMI shall be repaid in the form of interest charged on loan outstanding balance on monthly rest.<br>
            iii. In case of part disbursement, pre-EMI shall be applicable on loan outstanding balance till final disbursement.
          </td>
        </tr>
        <tr>
          <td class="num">13</td>
          <td class="label">Repayment Frequency</td>
          <td class="value">Monthly</td>
        </tr>
        <tr>
          <td class="num">14</td>
          <td class="label">Repayment Mode</td>
          <td class="value">EMIs or pre-EMIs shall be paid by the way of PDC/ E-Mandate on respective due dates</td>
        </tr>
      </tbody>
    </table>

    <div class="signatures-row">
      <div class="sig-box">Applicant Sign</div>
      <div class="sig-box">Co-Applicant1 Sign</div>
      <div class="sig-box">Co-Applicant2 Sign</div>
      <div class="sig-box">Co-Applicant3 Sign</div>
    </div>
  </div>

  <!-- Page 3: Key Facts Statement Part 1 (continued) -->
  <div class="page">
    <table class="kfs-table">
      <tbody>
        <tr>
          <td class="num">15</td>
          <td class="label">Equated Monthly Installments ("EMI")</td>
          <td class="value">&#8377;. {{emi_amount}}/-</td>
        </tr>
        <tr>
          <td class="num">16</td>
          <td class="label">Repayment Due Date</td>
          <td class="value">{{emi_due_date}}</td>
        </tr>
        <tr>
          <td class="num">17</td>
          <td class="label">Rate Type</td>
          <td class="value">Fixed</td>
        </tr>
        <tr>
          <td class="num">18</td>
          <td class="label">Method of Interest</td>
          <td class="value">Reducing Balance</td>
        </tr>
        <tr>
          <td class="num">19</td>
          <td class="label">Applicable Rate of interest (ROI)</td>
          <td class="value">
            ROI: {{total_roi}}% p.a.<br>
            Base Rate: {{base_rate}}%<br>
            Spread rate: {{spread_rate}}%<br>
            SFPL Base Rate shall mean the base rate of SFPL, as determined by it and mentioned at its website, from time to time or notified to the Borrower.
          </td>
        </tr>
        <tr>
          <td class="num">20</td>
          <td class="label">Security Details</td>
          <td class="value">
            Mortgage by way of first and exclusive charge on the property bearing<br>
            Collateral 1 - {{collateral_description}}<br>
            Owner name - {{collateral_owner_name}}
          </td>
        </tr>
        <tr>
          <td class="num">21</td>
          <td class="label">Cross Collateralization</td>
          <td class="value">
            i. Securities offered for one or more facilities and charged to the SFPL shall stand as additional securities for all other facilities now granted or to be granted from time to time.<br>
            ii. Collateral securities offered for the facilities of one borrower entity/individual are cross collateralized for the facilities of another borrower entity/individual and vice versa.
          </td>
        </tr>
        <tr>
          <td class="num">22</td>
          <td class="label">Validity of sanction</td>
          <td class="value">Valid till 30 days from the date of issue of this Sanction Letter unless the Facility Agreement is executed.</td>
        </tr>
        <tr>
          <td class="num">23</td>
          <td class="label">Charges applicable</td>
          <td class="value">Refer annexure A</td>
        </tr>
        <tr>
          <td class="num">24</td>
          <td class="label">Penal Charges</td>
          <td class="value">Delay in payment of instalment(s) shall attract Penal Charge at the rate of 36% per annum on the overdue amount from the respective due date until the date of receipt of the full instalment(s) amount.</td>
        </tr>
        <tr>
          <td class="num">25</td>
          <td class="label">Documentation</td>
          <td class="value">
            1. General Terms and Conditions<br>
            2. Registered Mortgage Deed<br>
            3. Declaration<br>
            4. Demand Promissory Note<br>
            5. Affidavit for Dual Name/ Signature (if applicable)<br>
            6. Balance Transfer Letters (if applicable)<br>
            7. Disbursal request letter<br>
            8. Specimen Signature letter/ Bank signature verification
          </td>
        </tr>
        <tr>
          <td class="num">26</td>
          <td class="label">Communication mode of change in interest rate (if any)</td>
          <td class="value">Email/ Letter/ Website/ Notice at branches/ SMS/ Annexures to statement of account (SOA)</td>
        </tr>
        <tr>
          <td class="num">27</td>
          <td class="label">Collateral</td>
          <td class="value">6 undated cheques (EMI/ SPDC)</td>
        </tr>
        <tr>
          <td class="num">28</td>
          <td class="label">Conditions Precedent to Sanction</td>
          <td class="value">This sanction is subject to completion of all pre-disbursement formalities as specified by SFPL.</td>
        </tr>
      </tbody>
    </table>

    <div class="signatures-row">
      <div class="sig-box">Applicant Sign</div>
      <div class="sig-box">Co-Applicant1 Sign</div>
      <div class="sig-box">Co-Applicant2 Sign</div>
      <div class="sig-box">Co-Applicant3 Sign</div>
    </div>
  </div>

  <!-- Page 4: Annexure A -->
  <div class="page">
    <h2 class="section-title center">ANNEXURE - A</h2>
    <h3 class="sub-title center">Schedule of Charges</h3>

    <p class="annex-subhead">a) Charges applicable on disbursement</p>
    <table class="charges-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Type of transactions</th>
          <th>Charges (&#8377;)</th>
        </tr>
      </thead>
      <tbody>
        {{#each disbursement_charges}}
        <tr>
          <td>{{sr_no}}</td>
          <td>{{type}}</td>
          <td>{{charges}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <p class="annex-subhead">b) Part Prepayment/ Foreclosure Charges</p>
    <table class="charges-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Type</th>
          <th>Charges</th>
        </tr>
      </thead>
      <tbody>
        {{#each prepayment_charges}}
        <tr>
          <td>{{sr_no}}</td>
          <td>{{type}}</td>
          <td>{{charges}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <p class="note">*The above part prepayment and foreclosure charges are subject to the regulatory requirements and directions prescribed by Reserve Bank of India from time to time.</p>

    <p class="annex-subhead">c) Other Fees and Charges</p>
    <table class="charges-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Type</th>
          <th>Charges</th>
        </tr>
      </thead>
      <tbody>
        {{#each other_charges}}
        <tr>
          <td>{{sr_no}}</td>
          <td>{{type}}</td>
          <td>{{charges}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <p class="note">*Please note that the above fee and charges are exclusive of GST or any other government taxes, levies etc. The above schedule of charges is subject to change and will be at sole discretion of SFPL.</p>

    <div class="signatures-row">
      <div class="sig-box">Applicant Sign</div>
      <div class="sig-box">Co-Applicant1 Sign</div>
      <div class="sig-box">Co-Applicant2 Sign</div>
      <div class="sig-box">Co-Applicant3 Sign</div>
    </div>
  </div>

  <!-- Page 5: Terms and Conditions -->
  <div class="page">
    <h2 class="section-title center">TERMS AND CONDITIONS OF SANCTION</h2>
    <p class="tnc-intro">This Annexure forms an integral part of the Loan Sanction Letter issued to the Borrower and shall be read in conjunction with the Sanction Letter, General Terms &amp; Conditions, and all executed loan and security documents.</p>

    <div class="tnc-section">
      <h4>1. Borrower Obligations</h4>
      <p><strong>1.1 Notification of Changes</strong> - The Borrower shall promptly notify the Lender in writing of any change in: (a) residential or business address; (b) the primary bank account used for repayment instruments; (c) repayment capacity; or (d) any information or documents previously submitted to the Lender. Such notification shall be provided within thirty (30) days from the date of occurrence of the change.</p>
      <p><strong>1.2 Routing of Business Proceeds</strong> - The Borrower shall ensure that all business proceeds continue to be deposited in the account from which repayment instructions are issued.</p>
      <p><strong>1.3 Change of Business Details</strong> - The Borrower shall immediately notify the Lender in writing of any change in its business address.</p>
      <p><strong>1.4 Permissible Use of Loan Proceeds</strong> - The Borrower shall use the Loan strictly for the approved business purpose(s). The Loan shall not be utilized for: illegal or immoral activities, gambling, lottery, racing, betting, or speculative activities.</p>
      <p><strong>1.5 Maintenance of Security</strong> - The Borrower shall maintain the Security in good condition and carry out all necessary repairs or improvements during the loan tenure.</p>
      <p><strong>1.6 Payment of Taxes and Dues</strong> - The Borrower shall pay all applicable municipal taxes, ground rent, and local charges related to the Security.</p>
      <p><strong>1.7 Inspection of Security</strong> - The Borrower shall provide free access to the Lender's authorized representatives to inspect the Security at any reasonable time.</p>
      <p><strong>1.8 Execution of Documentation</strong> - The Borrower shall execute, sign, and deliver all deeds, documents, and writings as required by the Lender.</p>
      <p><strong>1.9 Restriction on Transfer of Security</strong> - The Borrower shall not sell, lease, license, rent, or otherwise transfer or dispose of the Security without the prior written consent of the Lender.</p>
      <p><strong>1.10 Change or Loss of Occupation</strong> - The Borrower shall immediately notify the Lender in writing of any change or loss of employment, business, or profession.</p>
      <p><strong>1.11 Insurance of Security</strong> - The Borrower shall ensure that the Security is adequately insured at all times against risks including but not limited to fire, earthquake, explosion, storm, cyclone, etc.</p>
    </div>

    <div class="tnc-section">
      <h4>2. Pre-EMI Interest</h4>
      <p>Pre-EMI interest shall be charged at the same rate at which EMI is calculated, from the respective date of each disbursement until the EMI commencement date.</p>
    </div>

    <div class="tnc-section">
      <h4>3. Prepayment Terms</h4>
      <p>The Lender may, at its discretion, permit prepayment or part-prepayment upon the Borrower providing 15 working days' prior written notice. Prepayment/ part-prepayment is permitted only after 12 EMIs have been paid from the date of disbursement.</p>
    </div>

    <div class="tnc-section">
      <h4>4. Interest Application</h4>
      <p>Interest shall be applicable from the earlier of: the date the loan/tranche amount is credited to the Borrower's account, or the date the pay order is handed over as per the Borrower's instructions.</p>
    </div>
  </div>

  <!-- Page 6: Terms (continued) + Acceptance -->
  <div class="page">
    <div class="tnc-section">
      <h4>5. Execution of Loan Documents</h4>
      <p>The Borrower shall execute all necessary agreements including General Terms &amp; Conditions, Security documents, Declarations and undertakings, and any other documents required by the Lender.</p>
    </div>

    <div class="tnc-section">
      <h4>6. Balance Transfer Documentation</h4>
      <p>In cases of balance transfer, the Borrower shall execute additional documents as prescribed by the Lender.</p>
    </div>

    <div class="tnc-section">
      <h4>7. Legal &amp; Technical Clearance</h4>
      <p>Disbursement of the Loan is subject to satisfactory legal and technical verification of the proposed Security.</p>
    </div>

    <div class="tnc-section">
      <h4>8. Verification of KYC and Other Documents</h4>
      <p>Disbursement shall be made only after the Lender is satisfied with the online/offline verification of KYC documents, residence proof, identity proof, and any other details submitted by the Borrower.</p>
    </div>

    <div class="tnc-section">
      <h4>9. CERSAI Registration</h4>
      <p>Details of the Security shall be registered with the Central Registry of Securitization Asset Reconstruction and Security Interest of India (CERSAI).</p>
    </div>

    <div class="tnc-section">
      <h4>10. Consent for Data Submission</h4>
      <p>By accepting the sanction letter, the Borrower gives explicit consent for submission of customer information to CKYC, CERSAI, credit bureaus, and other regulatory authorities as required.</p>
    </div>

    <div class="tnc-section">
      <h4>11. Insurance Requirements</h4>
      <p>The collateral shall remain insured at all times. The Borrower may opt for the Group Insurance Scheme offered, or any insurance provider of their choice.</p>
    </div>

    <div class="tnc-section">
      <h4>12. Risk-Based Pricing</h4>
      <p>Interest rates are determined based on factors including: risk gradation, cost of funds, loan tenure, collateral type and value, borrower's income and credit history.</p>
    </div>

    <div class="tnc-section">
      <h4>13. Right to Modify Terms</h4>
      <p>The Lender reserves the right to add, delete, or amend any terms and conditions relating to the loan facility at its discretion.</p>
    </div>

    <div class="tnc-section">
      <h4>14. Return of Original Property Documents</h4>
      <p>Upon full closure of the loan and provided no other loan is outstanding against the same property: The Lender shall return the original property documents within 30 days.</p>
    </div>

    <div class="tnc-section">
      <h4>15. Consequences of delayed repayment</h4>
      <p>The Borrower's loan account shall, upon occurrence of any default, be classified as a Special Mention Account ("SMA") or a Non-Performing Asset ("NPA") in accordance with RBI guidelines.</p>
      <table class="sma-table">
        <thead>
          <tr><th>SMA Sub-categories</th><th>Overdue Days</th></tr>
        </thead>
        <tbody>
          <tr><td>SMA - 0</td><td>Up to 30 days</td></tr>
          <tr><td>SMA - 1</td><td>31 - 60 days</td></tr>
          <tr><td>SMA - 2</td><td>61 - 90 days</td></tr>
          <tr><td>NPA</td><td>More than 90 days</td></tr>
        </tbody>
      </table>
    </div>

    <div class="acceptance-section">
      <p>I/ We (as Borrower/s) read and accept the above terms and conditions of the sanction letter:</p>
      <table class="accept-table">
        <thead>
          <tr><th>Name</th><th>Acceptance Date</th><th>Signature</th></tr>
        </thead>
        <tbody>
          <tr><td>{{borrower_name}}</td><td>{{applicant_signature_date}}</td><td></td></tr>
          <tr><td>{{co_borrower_name}}</td><td>{{co_applicant1_signature_date}}</td><td></td></tr>
        </tbody>
      </table>
    </div>

    <div class="signoff">
      <p>For Satyam Finlease Pvt Ltd</p>
      <p><strong>{{authorized_signatory_name}}</strong></p>
      <p>Authorized Signatory</p>
    </div>
  </div>
</body>
</html>`,
  css_content: `@page {
  size: A4;
  margin: 60px 40px 50px 40px;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #1a1a1a;
  font-size: 11px;
  line-height: 1.5;
  margin: 0;
  padding: 0;
}

.page {
  page-break-after: always;
}

.page:last-child {
  page-break-after: auto;
}

/* Cover Page */
.letter-date {
  text-align: right;
  margin-bottom: 30px;
  font-size: 12px;
}

.addressee {
  margin-bottom: 20px;
  font-size: 12px;
}

.addressee p {
  margin: 2px 0;
}

.app-meta {
  margin-bottom: 30px;
  font-size: 12px;
}

.app-meta p {
  margin: 4px 0;
}

.hero {
  text-align: center;
  margin: 40px 0;
}

.hero h1 {
  font-size: 28px;
  color: #1e3a5f;
  font-weight: 600;
}

.salutation {
  margin: 20px 0;
  font-size: 12px;
}

.body-text {
  margin: 15px 0;
  font-size: 11px;
}

.body-text p {
  margin: 8px 0;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  font-size: 10px;
}

.summary-table th,
.summary-table td {
  border: 1px solid #333;
  padding: 8px 6px;
  text-align: center;
}

.summary-table th {
  background: #f0f0f0;
  font-weight: 600;
}

.closing {
  margin-top: 30px;
  font-size: 11px;
}

.divider {
  border-top: 1px solid #999;
  margin: 30px 0 10px 0;
}

.footer-note {
  font-size: 8px;
  color: #555;
  text-align: center;
  line-height: 1.4;
}

.footer-note p {
  margin: 2px 0;
}

/* KFS Tables */
.section-title {
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 20px;
  text-decoration: underline;
}

.sub-title {
  text-align: center;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 15px;
}

.center {
  text-align: center;
}

.kfs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}

.kfs-table td {
  border: 1px solid #333;
  padding: 8px 6px;
  vertical-align: top;
}

.kfs-table .num {
  width: 30px;
  text-align: center;
  font-weight: bold;
}

.kfs-table .label {
  width: 35%;
  font-weight: 600;
}

.kfs-table .value {
  width: 60%;
}

.signatures-row {
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
  font-size: 10px;
}

.sig-box {
  width: 22%;
  border-top: 1px solid #333;
  padding-top: 4px;
  text-align: center;
}

/* Annexure */
.annex-subhead {
  font-weight: bold;
  margin: 15px 0 8px 0;
  font-size: 11px;
}

.charges-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  margin-bottom: 15px;
}

.charges-table th,
.charges-table td {
  border: 1px solid #333;
  padding: 6px;
}

.charges-table th {
  background: #f0f0f0;
  font-weight: 600;
  text-align: left;
}

.note {
  font-size: 9px;
  color: #444;
  margin: 8px 0;
  font-style: italic;
}

/* Terms & Conditions */
.tnc-intro {
  font-size: 10px;
  margin-bottom: 15px;
  text-align: justify;
}

.tnc-section {
  margin-bottom: 12px;
}

.tnc-section h4 {
  font-size: 11px;
  margin-bottom: 6px;
  color: #1e3a5f;
}

.tnc-section p {
  margin: 4px 0;
  text-align: justify;
}

.sma-table {
  width: 60%;
  border-collapse: collapse;
  margin: 10px auto;
  font-size: 10px;
}

.sma-table th,
.sma-table td {
  border: 1px solid #333;
  padding: 5px 8px;
  text-align: center;
}

.sma-table th {
  background: #f0f0f0;
}

.acceptance-section {
  margin-top: 25px;
}

.acceptance-section p {
  font-size: 10px;
  margin-bottom: 8px;
}

.accept-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}

.accept-table th,
.accept-table td {
  border: 1px solid #333;
  padding: 8px;
}

.accept-table th {
  background: #f0f0f0;
  text-align: left;
}

.signoff {
  margin-top: 30px;
  text-align: right;
  font-size: 11px;
}

.signoff p {
  margin: 2px 0;
}`,
  sample_data: JSON.stringify({
    letter_date: '01/06/2026',
    applicant_first_name: 'Rahul',
    applicant_middle_name: 'Kumar',
    applicant_last_name: 'Sharma',
    applicant_address_line1: 'Flat 402, Sunshine Apartments',
    applicant_address_line2: 'Link Road, Malad West',
    city: 'Mumbai',
    pincode: '400064',
    state: 'Maharashtra',
    contact_number: '9876543210',
    application_number: 'QC-2026-05432',
    co_applicant_first_name: 'Priya',
    co_applicant_last_name: 'Sharma',
    loan_type: 'Secured term loan',
    loan_amount: '19,00,000',
    loan_amount_in_words: 'Nineteen Lakh',
    interest_rate: '18',
    emi_amount: '32,284',
    tenure_months: '144',
    emi_due_date: '3rd of every month',
    branch_manager_first_name: 'Vikram',
    branch_manager_last_name: 'Patel',
    branch_manager_contact: '98765 43210',
    borrower_name: 'Rahul Kumar Sharma',
    borrower_age: '38',
    borrower_address: 'Flat 402, Sunshine Apartments, Link Road, Malad West, Mumbai - 400064',
    borrower_pan: 'ABCDE1234F',
    borrower_mobile: '9876543210',
    borrower_email: 'rahul.sharma@email.com',
    co_borrower_name: 'Priya Sharma',
    co_borrower_age: '35',
    co_borrower_address: 'Flat 402, Sunshine Apartments, Link Road, Malad West, Mumbai - 400064',
    co_borrower_pan: 'FGHIJ5678K',
    co_borrower_mobile: '9876543211',
    co_borrower_email: 'priya.sharma@email.com',
    guarantor_name: '',
    guarantor_age: '',
    guarantor_address: '',
    guarantor_pan: '',
    guarantor_mobile: '',
    guarantor_email: '',
    product_name: 'Q-Rise',
    loan_purpose: 'Balance Transfer and Working Capital',
    first_tranche_amount: '15,00,000',
    first_tranche_in_words: 'Fifteen Lakh',
    final_tranche_amount: '4,00,000',
    final_tranche_in_words: 'Four Lakh',
    repayment_emi_count: '144',
    tenure_years: '12',
    base_rate: '16',
    spread_rate: '2',
    total_roi: '18',
    collateral_description: 'Residential Flat at Sunshine Apartments, Malad West',
    collateral_owner_name: 'Rahul Kumar Sharma',
    disbursement_charges: [
      { sr_no: '1', type: 'Processing Fees', charges: '2% i.e. Rs. 38,000/- (+ applicable taxes)' },
      { sr_no: '2', type: 'Login Fees', charges: 'Non-Refundable. Rs 500/- (+ applicable taxes)' },
      { sr_no: '3', type: 'Loan Application Fees', charges: 'Non-Refundable Rs 3,500/- (+ applicable taxes)' },
      { sr_no: '4', type: 'Administrative Fees', charges: 'Rs 4,000/- (+ applicable taxes)' },
      { sr_no: '5', type: 'Life Insurance Premium', charges: 'Rs 12,500/- Kotak Mahindra Life Insurance Co Ltd' },
      { sr_no: '6', type: 'Property Insurance Premium', charges: 'Rs 3,200/- Go Digit General Insurance Co Ltd' },
      { sr_no: '7', type: 'Health Insurance Premium', charges: 'Rs 0/-' },
      { sr_no: '8', type: 'Stamp Duty Charges', charges: 'Rs 5,000/-' },
      { sr_no: '9', type: 'CERSAI Charges', charges: 'Rs 500/- (+ applicable taxes)' },
      { sr_no: '10', type: 'CKYC Creation/ Updation fees', charges: 'Rs 200/- (+ applicable taxes)' }
    ],
    prepayment_charges: [
      { sr_no: '1', type: 'Part Prepayment', charges: 'Not allowed in first 12 months. Post 12 months - 5% of principal amount prepaid + applicable taxes' },
      { sr_no: '2', type: 'Foreclosure Charges', charges: 'Not allowed in first 12 months. Post 12 months - 5% of principal outstanding + applicable taxes' }
    ],
    other_charges: [
      { sr_no: '1', type: 'Loan Cancellation Charges (Post sanction acceptance)', charges: '2% of Sanctioned Amount + applicable taxes' },
      { sr_no: '2', type: 'Instrument Return Charge (Cheque / NACH)', charges: 'Rs 1000 + applicable taxes per Instrument' },
      { sr_no: '3', type: 'Cheque/Repayment mode swap charges', charges: 'Rs 500 + applicable taxes' },
      { sr_no: '4', type: 'Cheque Representation Charges', charges: 'Rs 100 + applicable taxes' },
      { sr_no: '5', type: 'Charges for missed due date', charges: 'Rs 500 + applicable taxes' },
      { sr_no: '6', type: 'Bounce EMI Collection Charges', charges: 'Rs 1000 + applicable taxes' },
      { sr_no: '7', type: 'Loan Statement/Duplicate Repayment Schedule Charges', charges: 'Rs 500 + applicable taxes' },
      { sr_no: '8', type: 'Pre-Payment letter fees', charges: 'Rs 500 + applicable taxes (Per document)' },
      { sr_no: '9', type: 'Charges for Copy of Property Papers', charges: 'Rs 1000 + applicable taxes' },
      { sr_no: '10', type: 'LOD Charges', charges: 'Rs 1000 + applicable taxes' },
      { sr_no: '11', type: 'Foreclosure report charges', charges: 'Rs 500 + applicable taxes' },
      { sr_no: '12', type: 'Document Custodian Charges', charges: 'Rs 2000 + applicable taxes (PM) post completion of loan tenure' },
      { sr_no: '13', type: 'Repossession Charges', charges: 'As Actuals' }
    ],
    applicant_signature_date: '05/06/2026',
    co_applicant1_signature_date: '05/06/2026',
    co_applicant2_signature_date: '',
    co_applicant3_signature_date: '',
    authorized_signatory_name: 'Rajesh Gupta'
  })
};

function seedDatabase() {
  const existing = TemplateModel.findAll();
  if (existing.length === 0) {
    TemplateModel.create(invoiceTemplate);
    TemplateModel.create(certificateTemplate);
    TemplateModel.create(sanctionLetterTemplate);
    logger.info('Database seeded with sample templates');
  } else {
    logger.info('Database already has templates, skipping seed');
  }
}

module.exports = { seedDatabase };
