// Manual mock for jspdf-autotable
const autoTableFn = jest.fn((doc, _options) => {
  // Mock autoTable implementation - just update doc.lastAutoTable
  if (doc) {
    doc.lastAutoTable = { finalY: 100 };
  }
  return null;
});

// Export as both default and named export
module.exports = {
  __esModule: true,
  default: autoTableFn,
};
module.exports.autoTable = autoTableFn;
