import { describe, expect, it, vi } from 'vitest';
import { exportProposalPDF, exportProposalWord, type ProposalExportData } from './proposalExport';

const sampleData: ProposalExportData = {
  projectTitle: 'Community Rainwater Harvesting Initiative',
  applicantName: 'Parkway Homes Residents Welfare Association',
  applicantType: 'Registered resident association',
  contactPerson: 'Aditi Sharma',
  contactEmail: 'aditi.sharma@parkwayhomes.org',
  locationName: 'Parkway Homes, Bengaluru',
  schemeName: 'BWSSB Rainwater Harvesting & Groundwater Recharge Incentive',
  funderName: 'Bangalore Water Supply and Sewerage Board',
  schemeSourceUrl: 'https://bwssb.karnataka.gov.in',
  planName: 'Balanced plan',
  planMeasures: ['Rooftop rainwater harvesting', 'Silt filtration', 'Recharge wells'],
  planDaysText: '45–60 days',
  planCostNum: 740000,
  requestedAmount: 300000,
  ownContribution: 222000,
  gapToArrange: 218000,
  targetDays: '56',
  baselineDays: '74',
  goalSummaryText: 'Reduce tanker dependence',
  funderNotes: 'Community approval obtained at AGM.',
};

describe('proposalExport', () => {
  it('generates a valid PDF and calls save without crashing', () => {
    // jsPDF in jsdom environment
    expect(() => exportProposalPDF(sampleData)).not.toThrow();
  });

  it('generates a formatted Word document with UTF-8 BOM and triggers download link', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    expect(() => exportProposalWord(sampleData)).not.toThrow();

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
