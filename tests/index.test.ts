import {
    CinnamonProjectFeature,
    CinnamonProjectFeatureForest, CinnamonProjectFeatureType,
    createCinnamonFeatureForest
} from "../src/struct/project.mjs";
import {forest, node} from "../src/struct/generic/feature_tree.mjs";

describe('test feature tree', () => {
    const cinnamonFeatureForest = createCinnamonFeatureForest();

    function testLevel0() {
        expect(cinnamonFeatureForest.getFeaturesForLevel(0).length).toBe(5);
        expect(cinnamonFeatureForest.getFeaturesForLevel(0)).toContain(CinnamonProjectFeature.VALIDATOR);
        expect(cinnamonFeatureForest.getFeaturesForLevel(0)).toContain(CinnamonProjectFeature.DATABASE);
        expect(cinnamonFeatureForest.getFeaturesForLevel(0)).toContain(CinnamonProjectFeature.ASL_PROTOCOL);
        expect(cinnamonFeatureForest.getFeaturesForLevel(0)).toContain(CinnamonProjectFeature.ASL_ERRORS);
        expect(cinnamonFeatureForest.getFeaturesForLevel(0)).toContain(CinnamonProjectFeature.WEBSERVER_SETTINGS_PLUGIN);
    }

    test('level 0 features should match all top-level features', testLevel0);

    test('level 1 features should match enabled level 0 children', () => {
        expect(cinnamonFeatureForest.getFeaturesForLevel(1).length).toBe(0);

        cinnamonFeatureForest.enable(CinnamonProjectFeature.DATABASE);

        expect(cinnamonFeatureForest.getFeaturesForLevel(1).length).toBe(1);
        expect(cinnamonFeatureForest.getFeaturesForLevel(1)).toContain(CinnamonProjectFeature.AUTHENTICATION);
    });

    test('level 0 should not have been affected by the previous step', testLevel0);

    test('level 2 features should match enabled level 1 children', () => {
        expect(cinnamonFeatureForest.getFeaturesForLevel(2).length).toBe(0);

        cinnamonFeatureForest.enable(CinnamonProjectFeature.AUTHENTICATION);

        expect(cinnamonFeatureForest.getFeaturesForLevel(2).length).toBe(2);
        expect(cinnamonFeatureForest.getFeaturesForLevel(2)).toContain(CinnamonProjectFeature.PUSH_TOKENS);
        expect(cinnamonFeatureForest.getFeaturesForLevel(2)).toContain(CinnamonProjectFeature.ASSET);
    });

    test('disabling level 0 should disable all children', () => {
        expect(cinnamonFeatureForest.getFeaturesForLevel(1).length).toBe(1);
        expect(cinnamonFeatureForest.getFeaturesForLevel(2).length).toBe(2);

        cinnamonFeatureForest.disable(CinnamonProjectFeature.DATABASE);

        expect(cinnamonFeatureForest.getFeaturesForLevel(1).length).toBe(0);
        expect(cinnamonFeatureForest.getFeaturesForLevel(2).length).toBe(0);
    });

    test('level 0 should not have been affected by the previous step', testLevel0);

    test('accessing a much deeper level should return an empty array', () => {
        expect(cinnamonFeatureForest.getFeaturesForLevel(100).length).toBe(0);
    });

    // see 'disabling level 0 should disable all children'
    test('re-enabling level 0 should re-enable all children', () => {
        cinnamonFeatureForest.enable(CinnamonProjectFeature.DATABASE);
        expect(cinnamonFeatureForest.getFeaturesForLevel(1).length).toBe(1);
        expect(cinnamonFeatureForest.getFeaturesForLevel(2).length).toBe(2);

    });

    test('getAllEnabled() should return all enabled features', () => {
        expect(cinnamonFeatureForest.getAllEnabled().length).toBe(2);
        expect(cinnamonFeatureForest.getAllEnabled()).toContain(CinnamonProjectFeature.DATABASE);
        expect(cinnamonFeatureForest.getAllEnabled()).toContain(CinnamonProjectFeature.AUTHENTICATION);

        cinnamonFeatureForest.enable(CinnamonProjectFeature.PUSH_TOKENS);
        cinnamonFeatureForest.enable(CinnamonProjectFeature.ASSET);

        expect(cinnamonFeatureForest.getAllEnabled().length).toBe(4);
        expect(cinnamonFeatureForest.getAllEnabled()).toContain(CinnamonProjectFeature.PUSH_TOKENS);
        expect(cinnamonFeatureForest.getAllEnabled()).toContain(CinnamonProjectFeature.ASSET);
    });
});

const createDodgyCinnamonFeatureForest = (): CinnamonProjectFeatureForest => {
    return forest<CinnamonProjectFeatureType>([
        node(CinnamonProjectFeature.VALIDATOR),
        node(CinnamonProjectFeature.VALIDATOR),
        node(CinnamonProjectFeature.DATABASE, [
            node(CinnamonProjectFeature.AUTHENTICATION, [
                node(CinnamonProjectFeature.PUSH_TOKENS),
                node(CinnamonProjectFeature.ASSET, [
                    node(CinnamonProjectFeature.AVATAR),
                ])
            ])
        ]),
        node(CinnamonProjectFeature.ASL_PROTOCOL),
        node(CinnamonProjectFeature.ASL_ERRORS),
        node(CinnamonProjectFeature.WEBSERVER_SETTINGS_PLUGIN),
    ]);
}

const createOtherDodgyCinnamonFeatureForest = (): CinnamonProjectFeatureForest => {
    return forest<CinnamonProjectFeatureType>([
        node(CinnamonProjectFeature.VALIDATOR),
        node(CinnamonProjectFeature.DATABASE, [
            node(CinnamonProjectFeature.AUTHENTICATION, [
                node(CinnamonProjectFeature.PUSH_TOKENS),
                node(CinnamonProjectFeature.ASSET, [
                    node(CinnamonProjectFeature.AVATAR),
                    node(CinnamonProjectFeature.VALIDATOR),
                ])
            ])
        ]),
        node(CinnamonProjectFeature.ASL_PROTOCOL),
        node(CinnamonProjectFeature.ASL_ERRORS),
        node(CinnamonProjectFeature.WEBSERVER_SETTINGS_PLUGIN),
    ]);
}

describe('test dodgy feature trees', () => {

    test('should throw an error when creating a dodgy feature tree', () => {
        expect(() => createDodgyCinnamonFeatureForest()).toThrow();
    });

    test('should throw an error when creating a dodgy feature tree', () => {
        expect(() => createOtherDodgyCinnamonFeatureForest()).toThrow();
    });

});
