
// /.netlify/functions/register.js
// Stub: accept player profile and log it. Replace with your datastore (Sheets, DB, or email service).

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== 'POST'){
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const data = JSON.parse(event.body||'{}');
    // In production, write to Google Sheets or a DB here.
    // Example: send to a form, Airtable, Supabase, or Google Sheets API.

    console.log('Player registered:', data);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }catch(err){
    return { statusCode: 500, body: err.message || 'Internal Error' };
  }
};
