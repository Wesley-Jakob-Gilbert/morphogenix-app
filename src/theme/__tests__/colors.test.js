import colors from '../colors';

describe('Swiss Alps color palette', () => {
  it('exports the new primary palette with the specified values', () => {
    expect(colors).toMatchObject({
      snow: '#FFFFFF',
      snowSoft: '#F4F6F8',
      emerald: '#7DD3B8',
      emeraldDeep: '#4FA88A',
      sky: '#8FC5E5',
      skyDeep: '#5A93B8',
      stone: '#6B7280',
      stoneDark: '#374151',
    });
  });

  it('leaves behavioral color tokens unchanged', () => {
    expect(colors.stateRed).toBe('#FF6B6B');
    expect(colors.premiumGold).toBe('#E5C572');
  });

  it('retains legacy tokens for existing screens', () => {
    expect(colors).toEqual(
      expect.objectContaining({
        navy: expect.any(String),
        teal: expect.any(String),
        amber: expect.any(String),
        violet: expect.any(String),
        surface: expect.any(String),
        base: expect.any(String),
        surfaceElevated: expect.any(String),
        muted: expect.any(String),
        white: expect.any(String),
        ink: expect.any(String),
        inkSoft: expect.any(String),
        shadow: expect.any(String),
      })
    );
  });
});
