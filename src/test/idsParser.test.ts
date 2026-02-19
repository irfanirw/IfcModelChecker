import { describe, it, expect } from 'vitest';
import { parseIdsXml, idsToRulePack } from '@/services/idsParser';

const MINIMAL_IDS = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <specification name="Wall Fire Rating" ifcVersion="IFC4">
    <applicability>
      <entity>
        <name><simpleValue>IfcWall</simpleValue></name>
      </entity>
    </applicability>
    <requirements>
      <property>
        <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
        <name><simpleValue>FireRating</simpleValue></name>
      </property>
    </requirements>
  </specification>
</ids>`;

const IDS_WITH_VALUE = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <specification name="Wall IsExternal" ifcVersion="IFC4">
    <applicability>
      <entity>
        <name><simpleValue>IfcWall</simpleValue></name>
      </entity>
    </applicability>
    <requirements>
      <property>
        <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
        <name><simpleValue>IsExternal</simpleValue></name>
        <value><simpleValue>true</simpleValue></value>
      </property>
    </requirements>
  </specification>
</ids>`;

const IDS_WITH_PATTERN = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <specification name="Naming Check" ifcVersion="IFC4">
    <applicability>
      <entity>
        <name><simpleValue>IfcWall</simpleValue></name>
      </entity>
    </applicability>
    <requirements>
      <attribute>
        <name><simpleValue>Name</simpleValue></name>
        <value>
          <xs:restriction>
            <xs:pattern value="^[A-Z]{3}_.*"/>
          </xs:restriction>
        </value>
      </attribute>
    </requirements>
  </specification>
</ids>`;

const MULTI_SPEC_IDS = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <specification name="Spec 1" ifcVersion="IFC4">
    <applicability>
      <entity><name><simpleValue>IfcWall</simpleValue></name></entity>
    </applicability>
    <requirements>
      <property>
        <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
        <name><simpleValue>FireRating</simpleValue></name>
      </property>
    </requirements>
  </specification>
  <specification name="Spec 2" ifcVersion="IFC4">
    <applicability>
      <entity><name><simpleValue>IfcDoor</simpleValue></name></entity>
    </applicability>
    <requirements>
      <property>
        <propertySet><simpleValue>Pset_DoorCommon</simpleValue></propertySet>
        <name><simpleValue>FireRating</simpleValue></name>
      </property>
    </requirements>
  </specification>
</ids>`;

describe('IDS Parser', () => {
    describe('parseIdsXml', () => {
        it('should parse minimal IDS with one specification', () => {
            const specs = parseIdsXml(MINIMAL_IDS);
            expect(specs).toHaveLength(1);
            expect(specs[0].name).toBe('Wall Fire Rating');
            expect(specs[0].ifcVersion).toBe('IFC4');
        });

        it('should extract entity applicability', () => {
            const specs = parseIdsXml(MINIMAL_IDS);
            expect(specs[0].applicability).toHaveLength(1);
            expect(specs[0].applicability[0].type).toBe('entity');
            expect(specs[0].applicability[0].entityName).toBe('IfcWall');
        });

        it('should extract property requirements', () => {
            const specs = parseIdsXml(MINIMAL_IDS);
            expect(specs[0].requirements).toHaveLength(1);
            expect(specs[0].requirements[0].facet.type).toBe('property');
            expect(specs[0].requirements[0].facet.psetName).toBe('Pset_WallCommon');
            expect(specs[0].requirements[0].facet.propertyName).toBe('FireRating');
        });

        it('should parse value constraints', () => {
            const specs = parseIdsXml(IDS_WITH_VALUE);
            expect(specs[0].requirements[0].facet.value).toBe('true');
        });

        it('should parse pattern constraints', () => {
            const specs = parseIdsXml(IDS_WITH_PATTERN);
            expect(specs[0].requirements[0].facet.type).toBe('attribute');
            expect(specs[0].requirements[0].facet.pattern).toBe('^[A-Z]{3}_.*');
        });

        it('should parse multiple specifications', () => {
            const specs = parseIdsXml(MULTI_SPEC_IDS);
            expect(specs).toHaveLength(2);
            expect(specs[0].name).toBe('Spec 1');
            expect(specs[1].name).toBe('Spec 2');
        });

        it('should throw on invalid XML', () => {
            expect(() => parseIdsXml('<not valid xml')).toThrow('Invalid IDS XML');
        });
    });

    describe('idsToRulePack', () => {
        it('should convert IDS specs to a RulePack', () => {
            const specs = parseIdsXml(MINIMAL_IDS);
            const pack = idsToRulePack(specs, 'test.ids');
            expect(pack.name).toBe('IDS: test.ids');
            expect(pack.version).toBe('1.0');
            expect(pack.rules).toHaveLength(1);
        });

        it('should map entity applicability to ifcClasses', () => {
            const specs = parseIdsXml(MINIMAL_IDS);
            const pack = idsToRulePack(specs, 'test.ids');
            expect(pack.rules[0].applicability.ifcClasses).toContain('IfcWall');
        });

        it('should set notEmpty check when no value or pattern given', () => {
            const specs = parseIdsXml(MINIMAL_IDS);
            const pack = idsToRulePack(specs, 'test.ids');
            expect(pack.rules[0].requirements[0].checkType).toBe('notEmpty');
        });

        it('should set equals check when value is given', () => {
            const specs = parseIdsXml(IDS_WITH_VALUE);
            const pack = idsToRulePack(specs, 'test.ids');
            expect(pack.rules[0].requirements[0].checkType).toBe('equals');
            expect(pack.rules[0].requirements[0].expected).toBe('true');
        });

        it('should set regex check when pattern is given', () => {
            const specs = parseIdsXml(IDS_WITH_PATTERN);
            const pack = idsToRulePack(specs, 'test.ids');
            expect(pack.rules[0].requirements[0].checkType).toBe('regex');
            expect(pack.rules[0].requirements[0].pattern).toBe('^[A-Z]{3}_.*');
        });

        it('should convert multiple specs to multiple rules', () => {
            const specs = parseIdsXml(MULTI_SPEC_IDS);
            const pack = idsToRulePack(specs, 'test.ids');
            expect(pack.rules).toHaveLength(2);
        });

        it('should generate unique rule IDs', () => {
            const specs = parseIdsXml(MULTI_SPEC_IDS);
            const pack = idsToRulePack(specs, 'test.ids');
            const ids = pack.rules.map((r) => r.id);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });
});
