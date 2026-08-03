import i18n from '../src/i18n';

describe('i18n Localization Suite', () => {
  it('should initialize with default language resource keys', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(['en', 'fr']).toContain(i18n.language);
  });

  it('should return English translations when language is en', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('app.profile')).toBe('Profile');
    expect(i18n.t('dateNavigator.today')).toBe('Today');
    expect(i18n.t('macroProgress.protein')).toBe('Protein');
    expect(i18n.t('mealBreakdown.title')).toBe('MEAL BREAKDOWN');
    expect(i18n.t('mealBreakdown.breakfast')).toBe('Breakfast');
    expect(i18n.t('mealBreakdown.target', { target: 500 })).toBe('Target: 500 kcal');
    expect(i18n.t('mealBreakdown.confirmDeleteTitle')).toBe('Delete Entry');
    expect(i18n.t('mealBreakdown.confirmDeleteMessage', { name: 'Apple' })).toBe('Are you sure you want to delete "Apple"?');
    expect(i18n.t('userProfile.sexLabel')).toBe('Biological Sex');
    expect(i18n.t('userProfile.currentWeightLabel')).toBe('Current Weight (kg)');
    expect(i18n.t('userProfile.targetWeightLabel')).toBe('Target Weight (kg)');
    expect(i18n.t('userProfile.heightLabel')).toBe('Height (cm)');
    expect(i18n.t('userProfile.ageLabel')).toBe('Age (yrs)');
    expect(i18n.t('userProfile.activityLabel')).toBe('Activity Level');
    expect(i18n.t('userProfile.muscleGainTitle')).toBe('Muscle Gain Objective');
    expect(i18n.t('userProfile.gainMuscleToggle')).toBe('Gain / Preserve Muscle Mass 🏋️');
    expect(i18n.t('userProfile.recompActiveBadge')).toBe('Body Recomposition Active (High Protein Target)');
    expect(i18n.t('userProfile.previewTitle')).toBe('Calculated Targets Preview');
    expect(i18n.t('userProfile.bmrLabel')).toBe('Base Metabolic Rate (BMR)');
    expect(i18n.t('userProfile.tdeeLabel')).toBe('Total Daily Energy Expenditure (TDEE)');
    expect(i18n.t('userProfile.recommendedCalorieTarget')).toBe('Recommended Daily Calorie Target');
    expect(i18n.t('userProfile.saveProfileBtn')).toBe('Save Profile & Targets');
  });

  it('should return French translations when language is fr', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('app.profile')).toBe('Profil');
    expect(i18n.t('dateNavigator.today')).toBe("Aujourd'hui");
    expect(i18n.t('macroProgress.protein')).toBe('Protéines');
    expect(i18n.t('mealBreakdown.title')).toBe('RÉPARTITION DES REPAS');
    expect(i18n.t('mealBreakdown.breakfast')).toBe('Petit-déjeuner');
    expect(i18n.t('mealBreakdown.target', { target: 500 })).toBe('Objectif: 500 kcal');
    expect(i18n.t('mealBreakdown.confirmDeleteTitle')).toBe("Supprimer l'entrée");
    expect(i18n.t('mealBreakdown.confirmDeleteMessage', { name: 'Pomme' })).toBe('Voulez-vous vraiment supprimer « Pomme » ?');
    expect(i18n.t('userProfile.sexLabel')).toBe('Sexe biologique');
    expect(i18n.t('userProfile.currentWeightLabel')).toBe('Poids actuel (kg)');
    expect(i18n.t('userProfile.targetWeightLabel')).toBe('Poids ciblé (kg)');
    expect(i18n.t('userProfile.heightLabel')).toBe('Taille (cm)');
    expect(i18n.t('userProfile.ageLabel')).toBe('Âge (ans)');
    expect(i18n.t('userProfile.activityLabel')).toBe("Niveau d'activité");
    expect(i18n.t('userProfile.muscleGainTitle')).toBe('Objectif de prise de muscle');
    expect(i18n.t('userProfile.gainMuscleToggle')).toBe('Prendre / Préserver la masse musculaire 🏋️');
    expect(i18n.t('userProfile.recompActiveBadge')).toBe('Recomposition corporelle active (Objectif protéique élevé)');
    expect(i18n.t('userProfile.previewTitle')).toBe('Aperçu des objectifs calculés');
    expect(i18n.t('userProfile.bmrLabel')).toBe('Métabolisme de base (MB)');
    expect(i18n.t('userProfile.tdeeLabel')).toBe('Dépense énergétique quotidienne (DEJT)');
    expect(i18n.t('userProfile.recommendedCalorieTarget')).toBe('Objectif calorique quotidien recommandé');
    expect(i18n.t('userProfile.saveProfileBtn')).toBe('Enregistrer le profil & les objectifs');
  });
});
