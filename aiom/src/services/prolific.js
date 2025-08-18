const axios = require('axios');

class ProlificService {
  constructor() {
    this.apiKey = process.env.PROLIFIC_API_KEY;
    this.apiUrl = 'https://api.prolific.com/api/v1';
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Get study details
  async getStudy(studyId) {
    try {
      const response = await this.client.get(`/studies/${studyId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching study:', error.response?.data || error.message);
      throw error;
    }
  }

  // Pay bonus to participant
  async payBonus(participantId, studyId, amount, reason) {
    try {
      const response = await this.client.post('/submissions/bonus-payments/', {
        participant_id: participantId,
        study_id: studyId,
        amount,
        reason
      });
      return response.data;
    } catch (error) {
      console.error('Error paying bonus:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get study submissions
  async getSubmissions(studyId) {
    try {
      const response = await this.client.get(`/studies/${studyId}/submissions/`);
      return response.data.results;
    } catch (error) {
      console.error('Error fetching submissions:', error.response?.data || error.message);
      throw error;
    }
  }

  // Complete experiment for participant
  async completeExperiment(participantId) {
    try {
      const response = await this.client.post(`/submissions/${participantId}/complete/`);
      return response.data;
    } catch (error) {
      console.error('Error completing experiment:', error.response?.data || error.message);
      throw error;
    }
  }

  // automatically approve submissions
  async approveSubmissions(submissionIds) {
    try {
      const response = await this.client.post('/submissions/approve/', {
        submission_ids: submissionIds
      });
      return response.data;
    } catch (error) {
      console.error('Error approving submissions:', error.response?.data || error.message);
      throw error;
    }
  }

  async getCompletionRedirectUrl(studyId, completion_status) {
    try {
      const response = await this.client.get(`/studies/${studyId}/`);
      const completionCodes = response.data.completion_codes;
      
      let code;
      // Select the appropriate code based on quality
      code = completionCodes.find(c => c.code_type === completion_status)?.code;
      
      // Fallback to first code if we couldn't find a matching one
      if (!code && completionCodes.length > 0) {
        code = completionCodes[0].code;
      }
      
      return `https://app.prolific.com/submissions/complete?cc=${code}`;
    } catch (error) {
      console.error('Error fetching completion redirect URL:', error.response?.data || error.message);
      throw error;
    }
  }

}

module.exports = new ProlificService();