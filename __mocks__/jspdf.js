// Manual mock for jsPDF
const jsPDFMock = jest.fn().mockImplementation(() => ({
  text: jest.fn(),
  setFontSize: jest.fn(),
  setFont: jest.fn(),
  setTextColor: jest.fn(),
  setFillColor: jest.fn(),
  rect: jest.fn(),
  roundedRect: jest.fn(),
  getTextWidth: jest.fn(() => 50),
  addPage: jest.fn(),
  save: jest.fn(),
  output: jest.fn(
    () => new Blob(['mock-pdf-content'], { type: 'application/pdf' })
  ),
  internal: {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
    pages: [null, {}],
    getCurrentPageInfo: () => ({ pageNumber: 1 }),
  },
  lastAutoTable: {
    finalY: 100,
  },
}));

module.exports = {
  __esModule: true,
  default: jsPDFMock,
  jsPDF: jsPDFMock,
};
