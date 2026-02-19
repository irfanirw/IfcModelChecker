/**
 * Default IFC+SG Rule Pack v1.0
 * Singapore BIM Guide-inspired rules for IFC model validation
 */
import type { RulePack } from '@/types';

export const IFCSG_RULE_PACK_V1: RulePack = {
    name: 'IFC+SG Default',
    version: '1.0.0',
    description: 'Default validation rules based on IFC+SG guidelines. Checks common property sets for completeness and naming conventions.',
    rules: [
        // ===== Wall Rules =====
        {
            id: 'sg-wall-001',
            name: 'Wall: FireRating exists',
            description: 'Walls must have a FireRating property in Pset_WallCommon',
            applicability: { ifcClasses: ['IfcWall', 'IfcWallStandardCase'] },
            requirements: [
                { psetName: 'Pset_WallCommon', propertyName: 'FireRating', checkType: 'notEmpty' },
            ],
        },
        {
            id: 'sg-wall-002',
            name: 'Wall: IsExternal exists',
            description: 'Walls must specify whether they are external',
            applicability: { ifcClasses: ['IfcWall', 'IfcWallStandardCase'] },
            requirements: [
                { psetName: 'Pset_WallCommon', propertyName: 'IsExternal', checkType: 'exists' },
            ],
        },
        {
            id: 'sg-wall-003',
            name: 'Wall: LoadBearing exists',
            description: 'Walls must specify load-bearing status',
            applicability: { ifcClasses: ['IfcWall', 'IfcWallStandardCase'] },
            requirements: [
                { psetName: 'Pset_WallCommon', propertyName: 'LoadBearing', checkType: 'exists' },
            ],
        },
        {
            id: 'sg-wall-004',
            name: 'Wall: Reference not empty',
            description: 'Walls should have a Reference value',
            applicability: { ifcClasses: ['IfcWall', 'IfcWallStandardCase'] },
            requirements: [
                { psetName: 'Pset_WallCommon', propertyName: 'Reference', checkType: 'notEmpty' },
            ],
        },

        // ===== Door Rules =====
        {
            id: 'sg-door-001',
            name: 'Door: FireRating exists',
            description: 'Doors must have a FireRating property',
            applicability: { ifcClasses: ['IfcDoor'] },
            requirements: [
                { psetName: 'Pset_DoorCommon', propertyName: 'FireRating', checkType: 'notEmpty' },
            ],
        },
        {
            id: 'sg-door-002',
            name: 'Door: IsExternal exists',
            description: 'Doors must specify whether they are external',
            applicability: { ifcClasses: ['IfcDoor'] },
            requirements: [
                { psetName: 'Pset_DoorCommon', propertyName: 'IsExternal', checkType: 'exists' },
            ],
        },
        {
            id: 'sg-door-003',
            name: 'Door: Reference not empty',
            description: 'Doors should have a Reference value',
            applicability: { ifcClasses: ['IfcDoor'] },
            requirements: [
                { psetName: 'Pset_DoorCommon', propertyName: 'Reference', checkType: 'notEmpty' },
            ],
        },

        // ===== Window Rules =====
        {
            id: 'sg-window-001',
            name: 'Window: FireRating exists',
            description: 'Windows must have a FireRating property',
            applicability: { ifcClasses: ['IfcWindow'] },
            requirements: [
                { psetName: 'Pset_WindowCommon', propertyName: 'FireRating', checkType: 'notEmpty' },
            ],
        },
        {
            id: 'sg-window-002',
            name: 'Window: IsExternal exists',
            description: 'Windows must specify whether they are external',
            applicability: { ifcClasses: ['IfcWindow'] },
            requirements: [
                { psetName: 'Pset_WindowCommon', propertyName: 'IsExternal', checkType: 'exists' },
            ],
        },
        {
            id: 'sg-window-003',
            name: 'Window: ThermalTransmittance not empty',
            description: 'Windows should have thermal transmittance value',
            applicability: { ifcClasses: ['IfcWindow'] },
            requirements: [
                { psetName: 'Pset_WindowCommon', propertyName: 'ThermalTransmittance', checkType: 'notEmpty' },
            ],
        },

        // ===== Slab Rules =====
        {
            id: 'sg-slab-001',
            name: 'Slab: LoadBearing exists',
            description: 'Slabs must specify load-bearing status',
            applicability: { ifcClasses: ['IfcSlab'] },
            requirements: [
                { psetName: 'Pset_SlabCommon', propertyName: 'LoadBearing', checkType: 'exists' },
            ],
        },
        {
            id: 'sg-slab-002',
            name: 'Slab: IsExternal exists',
            description: 'Slabs must specify whether they are external',
            applicability: { ifcClasses: ['IfcSlab'] },
            requirements: [
                { psetName: 'Pset_SlabCommon', propertyName: 'IsExternal', checkType: 'exists' },
            ],
        },
        {
            id: 'sg-slab-003',
            name: 'Slab: FireRating not empty',
            description: 'Slabs should have a FireRating value',
            applicability: { ifcClasses: ['IfcSlab'] },
            requirements: [
                { psetName: 'Pset_SlabCommon', propertyName: 'FireRating', checkType: 'notEmpty' },
            ],
        },

        // ===== Beam Rules =====
        {
            id: 'sg-beam-001',
            name: 'Beam: LoadBearing exists',
            description: 'Beams must specify load-bearing status',
            applicability: { ifcClasses: ['IfcBeam'] },
            requirements: [
                { psetName: 'Pset_BeamCommon', propertyName: 'LoadBearing', checkType: 'exists' },
            ],
        },
        {
            id: 'sg-beam-002',
            name: 'Beam: Reference not empty',
            description: 'Beams should have a Reference value',
            applicability: { ifcClasses: ['IfcBeam'] },
            requirements: [
                { psetName: 'Pset_BeamCommon', propertyName: 'Reference', checkType: 'notEmpty' },
            ],
        },

        // ===== Column Rules =====
        {
            id: 'sg-column-001',
            name: 'Column: LoadBearing exists',
            description: 'Columns must specify load-bearing status',
            applicability: { ifcClasses: ['IfcColumn'] },
            requirements: [
                { psetName: 'Pset_ColumnCommon', propertyName: 'LoadBearing', checkType: 'exists' },
            ],
        },
        {
            id: 'sg-column-002',
            name: 'Column: Reference not empty',
            description: 'Columns should have a Reference value',
            applicability: { ifcClasses: ['IfcColumn'] },
            requirements: [
                { psetName: 'Pset_ColumnCommon', propertyName: 'Reference', checkType: 'notEmpty' },
            ],
        },

        // ===== General Naming Convention =====
        {
            id: 'sg-naming-001',
            name: 'Element Name Convention',
            description: 'Element names should follow naming convention (no special characters except dash, underscore, colon)',
            applicability: {
                ifcClasses: [
                    'IfcWall', 'IfcWallStandardCase', 'IfcDoor', 'IfcWindow',
                    'IfcSlab', 'IfcBeam', 'IfcColumn', 'IfcRoof', 'IfcStair',
                ],
            },
            requirements: [
                {
                    psetName: '__attributes__',
                    propertyName: 'Name',
                    checkType: 'regex',
                    pattern: '^[a-zA-Z0-9_\\-:. ]+$',
                    severity: 'Error',
                },
            ],
        },

        // ===== Space Rules =====
        {
            id: 'sg-space-001',
            name: 'Space: Reference not empty',
            description: 'Spaces should have a Reference value',
            applicability: { ifcClasses: ['IfcSpace'] },
            requirements: [
                { psetName: 'Pset_SpaceCommon', propertyName: 'Reference', checkType: 'notEmpty' },
            ],
        },

        // ===== Roof Rules =====
        {
            id: 'sg-roof-001',
            name: 'Roof: IsExternal exists',
            description: 'Roofs must specify whether they are external',
            applicability: { ifcClasses: ['IfcRoof'] },
            requirements: [
                { psetName: 'Pset_RoofCommon', propertyName: 'IsExternal', checkType: 'exists' },
            ],
        },

        // ===== Curtain Wall Rules =====
        {
            id: 'sg-cw-001',
            name: 'CurtainWall: IsExternal exists',
            description: 'Curtain walls must specify whether they are external',
            applicability: { ifcClasses: ['IfcCurtainWall'] },
            requirements: [
                { psetName: 'Pset_CurtainWallCommon', propertyName: 'IsExternal', checkType: 'exists' },
            ],
        },
    ],
};
