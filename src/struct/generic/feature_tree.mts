type FeatureNodeIdentifier = string|number;

export interface FeatureNodeMetadata<T extends FeatureNodeIdentifier> {
    readonly id: T;
    readonly name: string;
    readonly description: string;
}

export class FeatureNode<T extends FeatureNodeIdentifier> {
    public readonly metadata: FeatureNodeMetadata<T>;
    private readonly _children: FeatureNode<T>[];

    public enabled: boolean;

    public get children(): FeatureNode<T>[] {
        return [...this._children];
    }

    public checkChildren(parentIds: T[]) {
        // First check that no two siblings have the same ID.
        const ids = this._children.map(child => child.metadata.id);
        if ((new Set(ids)).size !== ids.length) {
            throw new Error(`Duplicate feature IDs found (each one must be registered at most once).`);
        }

        // Then recursively check each of the children.
        for (const child of this._children) {
            if (parentIds.includes(child.metadata.id)) {
                throw new Error(`Duplicate feature ID: ${child.metadata.id} (each one must be registered at most once).`);
            }

            child.checkChildren([...parentIds, child.metadata.id]);
        }
    }

    constructor(
        metadata: FeatureNodeMetadata<T>,
        children: FeatureNode<T>[],
        enabled: boolean,
    ) {
        this.metadata = metadata;
        this._children = children;
        this.enabled = enabled;
    }
}

export class FeatureForest<T extends FeatureNodeIdentifier> {
    private readonly _topology: FeatureNode<T>[];

    constructor(topology: FeatureNode<T>[]) {
        this._topology = topology;

        // Check that no two siblings have the same ID.
        const ids = this._topology.map(child => child.metadata.id);
        if ((new Set(ids)).size !== ids.length) {
            throw new Error(`Duplicate feature IDs found (each one must be registered at most once).`);
        }

        // Check each of the children.
        for (const node of this._topology) {
            node.checkChildren(this._topology.map(node => node.metadata.id));
        }
    }

    private findNodeInTopology(id: T): FeatureNode<T> | undefined {
        let desired = this._topology.find(node => node.metadata.id === id);
        if (desired) return desired;

        for (const node of this._topology) {
            const result = new FeatureForest(node.children).findNodeInTopology(id);
            if (result) return result;
        }
    }

    private _computeFeaturesForLevel(level: number,
                                     nodes: FeatureNode<T>[],
                                     currentLevel: number = 0): FeatureNodeMetadata<T>[] {
        // If the current level is the level we're looking for, return the
        // metadata for all features at this level.
        if (currentLevel == level) {
            return nodes.map(node => node.metadata);
        }

        // Otherwise, return all features at the given level where the parent
        // feature is enabled.
        const nextNodes = nodes.filter(node => node.enabled).flatMap(node => node.children);
        // If there are no more nodes, return an empty array.
        if (nextNodes.length == 0) return [];
        return this._computeFeaturesForLevel(level, nextNodes, currentLevel + 1);
    }

    /**
     * Returns the features that can be toggled at the given level.
     * Level 0 is the top level and so all top level features are returned,
     * regardless of what is enabled or disabled.
     *
     * As the level increases deeper into the tree, only features that are
     * enabled are returned. This means that if a feature is disabled, all of
     * its children are also disabled.
     *
     * For example, if the feature tree looks like this:
     *
     * <pre>
     * - A
     *      - B
     *          - C
     *      - D
     *          - E
     * </pre>
     *
     * Then, if A is enabled, getFeaturesForLevel(1) will return [B, D].
     * If B is disabled, getFeaturesForLevel(2) will return [E].
     * If B and D are both disabled, getFeaturesForLevel(1) will return [],
     * and so would getFeaturesForLevel(2).
     *
     * Regardless of whether A is enabled, getFeaturesForLevel(0) will return
     * [A].
     *
     * To put it another way, this is the set of features that can be toggled
     * at the given level - i.e., an enabled parent feature has given this
     * level these features to toggle.
     *
     * You can trivially get the set of enabled features at a given level by
     * calling getFeaturesForLevel and then filtering out the disabled ones.
     * This function is provided as {@link getEnabledFeaturesForLevel} for
     * convenience.
     *
     * @param level The level to get features for.
     *
     * @see getEnabledFeaturesForLevel - a similar function that returns only
     *                                  enabled features at a given level.
     */
    public getFeaturesForLevel(level: number): FeatureNodeMetadata<T>[] {
        // If the level is 0, return all top-level features, regardless of
        // whether they are enabled or not.
        if (level == 0) return this._topology.map(node => node.metadata);

        // Otherwise, return all features at the given level where the parent
        // feature is enabled.
        return this._computeFeaturesForLevel(level, this._topology);
    }

    public getEnabledFeaturesForLevel(level: number): FeatureNodeMetadata<T>[] {
        return this.getFeaturesForLevel(level).filter(feature => this.get(feature));
    }

    /**
     * Returns the parent node of the given feature.
     * That is, the feature that must be enabled for the given feature to be
     * enabled.
     *
     * @param feature The feature to get the parent of.
     */
    public getParentOf(feature: T | FeatureNodeMetadata<T>): FeatureNodeMetadata<T> | undefined {
        if (typeof(feature) === 'object') {
            feature = (feature as FeatureNodeMetadata<T>).id;
        }

        const node = this.findNodeInTopology(feature)!;
        const parent = this._topology.find(currentNode => currentNode.children.includes(node))!;
        return parent.metadata;
    }

    /**
     * Returns whether the given feature is enabled.
     * @param feature The feature to check.
     */
    public get(feature: T | FeatureNodeMetadata<T>): boolean {
        if (typeof(feature) === 'object') {
            feature = (feature as FeatureNodeMetadata<T>).id;
        }

        return this.findNodeInTopology(feature)?.enabled ?? false;
    }

    /**
     * Return all enabled features in the tree.
     * @see getEnabledFeaturesForLevel - a similar function that returns only
     *                                   enabled features at a given level.
     */
    public getAllEnabled(): FeatureNodeMetadata<T>[] {
        // Start with the top level features that are enabled.
        let search = this._topology.filter(node => node.enabled);
        let enabled: FeatureNodeMetadata<T>[] = [];

        while (search.length > 0) {
            // Add all enabled features from the search list to the list.
            enabled.push(...search.map(node => node.metadata));
            // Then, search the children of all enabled features.
            search = search.flatMap(
                node => node.children.filter(node => node.enabled)
            );
        }

        // Finally, return the list of enabled features.
        return enabled;
    }

    /**
     * Sets the given feature to be enabled or disabled.
     * @param feature The feature to set.
     * @param enabled Whether the feature should be enabled or disabled.
     * @see enable - a similar function that enables a feature.
     * @see disable - a similar function that disables a feature.
     */
    public set(feature: T | FeatureNodeMetadata<T>, enabled: boolean) {
        if (typeof(feature) === 'object') {
            feature = (feature as FeatureNodeMetadata<T>).id;
        }
        
        this.findNodeInTopology(feature)!.enabled = enabled;
    }

    /**
     * Enables the given feature. An alias for {@link set} with enabled=true.
     * @param feature The feature to enable.
     * @see enableAll - enable multiple features at once.
     */
    public enable(feature: T | FeatureNodeMetadata<T>) {
        return this.set(feature, true);
    }

    /**
     * Enables all of the given features. An alias for {@link enable} for each
     * feature.
     * @param features The features to enable.
     */
    public enableAll(features: (T | FeatureNodeMetadata<T>)[]) {
        features.forEach(feature => this.enable(feature));
    }

    /**
     * Disables the given feature. An alias for {@link set} with enabled=false.
     * @param feature The feature to disable.
     * @see disableAll - disable multiple features at once.
     */
    public disable(feature: T | FeatureNodeMetadata<T>) {
        return this.set(feature, false);
    }

    /**
     * Disables all of the given features. An alias for {@link disable} for
     * each feature.
     * @param features The features to disable.
     */
    public disableAll(features: (T | FeatureNodeMetadata<T>)[]) {
        features.forEach(feature => this.disable(feature));
    }
}

export function feature<T extends FeatureNodeIdentifier>(id: T, name: string, description: string): FeatureNodeMetadata<T> {
    return {
        id,
        name,
        description,
    };
}

export function node<T extends FeatureNodeIdentifier>(metadata: FeatureNodeMetadata<T>,
                        children?: FeatureNode<T>[],
                        options?: {
                            enabled?: boolean,
                        }): FeatureNode<T> {
    return new FeatureNode<T>(
        metadata,
        children ?? [],
        options?.enabled ?? false,
    );
}

export function forest<T extends FeatureNodeIdentifier>(topology: FeatureNode<T>[]): FeatureForest<T> {
    return new FeatureForest<T>(topology);
}
