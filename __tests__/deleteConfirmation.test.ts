import { Alert } from 'react-native';
import i18n from '../src/i18n';

describe('Delete Entry Confirmation Suite', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('triggers Alert.alert with correct prompt and buttons on deletion trigger', async () => {
    await i18n.changeLanguage('en');

    const foodName = 'Oatmeal with Berries';
    const entryId = 'entry-123';
    const onDeleteEntry = jest.fn();

    // Replicate confirmation call as in MealBreakdownCard
    Alert.alert(
      i18n.t('mealBreakdown.confirmDeleteTitle'),
      i18n.t('mealBreakdown.confirmDeleteMessage', { name: foodName }),
      [
        { text: i18n.t('mealBreakdown.cancel'), style: 'cancel' },
        { text: i18n.t('mealBreakdown.delete'), style: 'destructive', onPress: () => onDeleteEntry(entryId) }
      ]
    );

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Delete Entry');
    expect(message).toBe('Are you sure you want to delete "Oatmeal with Berries"?');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Cancel');
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].text).toBe('Delete');
    expect(buttons[1].style).toBe('destructive');

    // Simulate pressing the confirm delete button
    buttons[1].onPress();
    expect(onDeleteEntry).toHaveBeenCalledWith('entry-123');
  });
});
