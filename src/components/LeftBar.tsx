import React, { useState, useMemo, useCallback } from 'react';
import {
    Box,
    Tabs,
    Tab,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Typography,
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Collapse,
    Badge,
    Chip,
    InputAdornment,
    Button,
} from '@mui/material';
import {
    ExpandMore,
    ExpandLess,
    Folder,
    AccountTree,
    ViewInAr,
    Search as SearchIcon,
    FilterList as FilterIcon,
} from '@mui/icons-material';

import {
    useModelStore,
    useSelectionStore,
    useFilterStore,
    useUIStore,
    useValidationStore,
} from '@/store';
import type { SpatialNode, TypeGroup, FilterState } from '@/types';

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
    return value === index ? <Box sx={{ flex: 1, overflow: 'auto' }}>{children}</Box> : null;
}

// ===== Spatial Tree Component =====

/** Maximum children to render before showing "Show more" */
const CHILDREN_PAGE_SIZE = 50;

/**
 * Iterative (non-recursive) collection of all expressIDs under a node.
 * Avoids call-stack overflow on deeply-nested or very wide trees.
 */
function collectElementIDs(root: SpatialNode): number[] {
    const ids: number[] = [];
    const stack: SpatialNode[] = [root];
    while (stack.length > 0) {
        const node = stack.pop()!;
        ids.push(node.expressID);
        const children = node.children;
        if (Array.isArray(children)) {
            for (let i = children.length - 1; i >= 0; i--) {
                if (children[i]) stack.push(children[i]);
            }
        }
    }
    return ids;
}

const SpatialTreeNode = React.memo(function SpatialTreeNode({ node, depth = 0 }: { node: SpatialNode; depth?: number }) {
    // Only auto-expand the root level with a small number of children.
    const children = Array.isArray(node.children) ? node.children : [];
    const [open, setOpen] = useState(depth < 1 && children.length <= 20);
    // Pagination: for nodes with hundreds of children, render in pages
    const [visibleCount, setVisibleCount] = useState(CHILDREN_PAGE_SIZE);
    const { select, addToSelection, clearSelection } = useSelectionStore();
    const hasChildren = children.length > 0;
    const isLeaf = node.isLeaf === true;

    const handleClick = useCallback(() => {
        if (isLeaf) {
            // Leaf element — single-select this one, shows properties in RightBar
            select(node.expressID);
        } else {
            // Structural node — select all descendant elements
            clearSelection();
            const ids = collectElementIDs(node);
            if (ids.length > 0) addToSelection(ids);
        }
    }, [node, isLeaf, select, addToSelection, clearSelection]);

    const handleToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen((prev) => !prev);
        // Reset pagination when collapsing
        setVisibleCount(CHILDREN_PAGE_SIZE);
    }, []);

    const handleShowMore = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setVisibleCount((prev) => prev + CHILDREN_PAGE_SIZE);
    }, []);

    // Guard against bad depth (shouldn't happen, but safety net)
    if (depth > 50) return null;

    const visibleChildren = children.slice(0, visibleCount);
    const hasMore = children.length > visibleCount;

    return (
        <>
            <ListItemButton
                sx={{ pl: depth * 2 + 1, py: 0.3 }}
                onClick={handleClick}
                dense
            >
                {hasChildren && (
                    <ListItemIcon sx={{ minWidth: 24 }} onClick={handleToggle}>
                        {open ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
                    </ListItemIcon>
                )}
                {!hasChildren && (
                    <ListItemIcon sx={{ minWidth: 24 }}>
                        {isLeaf
                            ? <ViewInAr fontSize="small" color="primary" sx={{ fontSize: 16 }} />
                            : <Folder fontSize="small" color="action" />}
                    </ListItemIcon>
                )}
                <ListItemText
                    primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                                {node.name || `#${node.expressID}`}
                            </Typography>
                            {!isLeaf && (node.elementCount ?? 0) > 0 && (
                                <Chip label={node.elementCount} size="small" sx={{ height: 18, fontSize: 10 }} />
                            )}
                        </Box>
                    }
                    secondary={node.ifcClass}
                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                />
            </ListItemButton>
            {hasChildren && (
                <Collapse in={open} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {visibleChildren.map((child) =>
                            child ? (
                                <SpatialTreeNode key={child.expressID} node={child} depth={depth + 1} />
                            ) : null
                        )}
                        {hasMore && (
                            <ListItemButton
                                sx={{ pl: (depth + 1) * 2 + 1, py: 0.3 }}
                                onClick={handleShowMore}
                                dense
                            >
                                <ListItemText
                                    primary={
                                        <Typography variant="caption" color="primary">
                                            Show more ({children.length - visibleCount} remaining)
                                        </Typography>
                                    }
                                />
                            </ListItemButton>
                        )}
                    </List>
                </Collapse>
            )}
        </>
    );
});

// ===== Type Tree Component (expandable to individual elements) =====
const TypeGroupNode = React.memo(function TypeGroupNode({ group }: { group: TypeGroup }) {
    const [open, setOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(CHILDREN_PAGE_SIZE);
    const { select, addToSelection, clearSelection } = useSelectionStore();
    const elements = useModelStore((s) => s.elements);

    const handleGroupClick = useCallback(() => {
        clearSelection();
        addToSelection(group.expressIDs);
    }, [group, addToSelection, clearSelection]);

    const handleToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen((prev) => !prev);
        setVisibleCount(CHILDREN_PAGE_SIZE);
    }, []);

    const handleElementClick = useCallback((expressID: number) => {
        // Single-select — shows properties in the RightBar inspector
        select(expressID);
    }, [select]);

    const handleShowMore = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setVisibleCount((prev) => prev + CHILDREN_PAGE_SIZE);
    }, []);

    const visibleIDs = group.expressIDs.slice(0, visibleCount);
    const hasMore = group.expressIDs.length > visibleCount;

    return (
        <>
            <ListItemButton
                onClick={handleGroupClick}
                dense
                sx={{ py: 0.3 }}
            >
                <ListItemIcon sx={{ minWidth: 24 }} onClick={handleToggle}>
                    {open ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
                </ListItemIcon>
                <ListItemIcon sx={{ minWidth: 24, mr: 0.5 }}>
                    <AccountTree fontSize="small" color="action" />
                </ListItemIcon>
                <ListItemText
                    primary={group.ifcClass}
                    primaryTypographyProps={{ variant: 'body2' }}
                />
                <Chip label={group.count} size="small" sx={{ height: 18, fontSize: 10 }} />
            </ListItemButton>
            <Collapse in={open} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                    {visibleIDs.map((eid) => {
                        const el = elements.get(eid);
                        const label = el ? (el.name || el.tag || el.globalId || `#${eid}`) : `#${eid}`;
                        const secondary = el ? (el.level || undefined) : undefined;
                        return (
                            <ListItemButton
                                key={eid}
                                dense
                                sx={{ pl: 5, py: 0.2 }}
                                onClick={() => handleElementClick(eid)}
                            >
                                <ListItemIcon sx={{ minWidth: 24 }}>
                                    <ViewInAr fontSize="small" color="primary" sx={{ fontSize: 16 }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Typography variant="body2" noWrap>
                                            {label}
                                        </Typography>
                                    }
                                    secondary={secondary}
                                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                                />
                            </ListItemButton>
                        );
                    })}
                    {hasMore && (
                        <ListItemButton
                            sx={{ pl: 5, py: 0.3 }}
                            onClick={handleShowMore}
                            dense
                        >
                            <ListItemText
                                primary={
                                    <Typography variant="caption" color="primary">
                                        Show more ({group.expressIDs.length - visibleCount} remaining)
                                    </Typography>
                                }
                            />
                        </ListItemButton>
                    )}
                </List>
            </Collapse>
        </>
    );
});

function TypeTreeView() {
    const { typeGroups } = useModelStore();

    return (
        <List dense>
            {typeGroups.map((group) => (
                <TypeGroupNode key={group.ifcClass} group={group} />
            ))}
        </List>
    );
}

// ===== Search & Filter Component =====
function SearchFilterView() {
    const filterStore = useFilterStore();
    const { elements, levels, zones, ifcClasses } = useModelStore();
    const { addToSelection, clearSelection } = useSelectionStore();

    const filteredElements = useMemo(() => {
        const result: number[] = [];
        elements.forEach((el, id) => {
            if (filterStore.discipline !== 'All' && el.discipline !== filterStore.discipline) return;
            if (filterStore.level !== 'All' && el.level !== filterStore.level) return;
            if (filterStore.zone !== 'All' && el.zone !== filterStore.zone) return;
            if (filterStore.ifcClass !== 'All' && el.ifcClass !== filterStore.ifcClass) return;
            if (filterStore.searchText) {
                const search = filterStore.searchText.toLowerCase();
                const match =
                    el.globalId.toLowerCase().includes(search) ||
                    el.name.toLowerCase().includes(search) ||
                    el.tag.toLowerCase().includes(search);
                if (!match) return;
            }
            // Validation status filter
            if (filterStore.validationStatus !== 'All') {
                const validationStore = useValidationStore.getState();
                const issues = validationStore.getIssuesForElement(id);
                if (filterStore.validationStatus === 'fail' && issues.length === 0) return;
                if (filterStore.validationStatus === 'pass' && issues.length > 0) return;
                if (filterStore.validationStatus === 'not-checked' && validationStore.validationResult !== null) return;
            }
            result.push(id);
        });
        return result;
    }, [filterStore, elements]);

    const handleApplyFilter = useCallback(() => {
        clearSelection();
        if (filteredElements.length > 0) {
            addToSelection(filteredElements);
        }
    }, [filteredElements]);

    return (
        <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
                size="small"
                placeholder="Search GlobalId, Name, Tag..."
                value={filterStore.searchText}
                onChange={(e) => filterStore.setFilter({ searchText: e.target.value })}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                    ),
                }}
                fullWidth
            />

            <FormControl size="small" fullWidth>
                <InputLabel>Discipline</InputLabel>
                <Select
                    value={filterStore.discipline}
                    label="Discipline"
                    onChange={(e) => filterStore.setFilter({ discipline: e.target.value as FilterState['discipline'] })}
                >
                    <MenuItem value="All">All</MenuItem>
                    <MenuItem value="Architecture">Architecture</MenuItem>
                    <MenuItem value="Structure">Structure</MenuItem>
                    <MenuItem value="MEP">MEP</MenuItem>
                </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
                <InputLabel>Level</InputLabel>
                <Select
                    value={filterStore.level}
                    label="Level"
                    onChange={(e) => filterStore.setFilter({ level: e.target.value as string })}
                >
                    <MenuItem value="All">All</MenuItem>
                    {levels.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
                <InputLabel>Zone</InputLabel>
                <Select
                    value={filterStore.zone}
                    label="Zone"
                    onChange={(e) => filterStore.setFilter({ zone: e.target.value as string })}
                >
                    <MenuItem value="All">All</MenuItem>
                    {zones.map((z) => <MenuItem key={z} value={z}>{z}</MenuItem>)}
                </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
                <InputLabel>IFC Class</InputLabel>
                <Select
                    value={filterStore.ifcClass}
                    label="IFC Class"
                    onChange={(e) => filterStore.setFilter({ ifcClass: e.target.value as string })}
                >
                    <MenuItem value="All">All</MenuItem>
                    {ifcClasses.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
                <InputLabel>Validation Status</InputLabel>
                <Select
                    value={filterStore.validationStatus}
                    label="Validation Status"
                    onChange={(e) => filterStore.setFilter({ validationStatus: e.target.value as FilterState['validationStatus'] })}
                >
                    <MenuItem value="All">All</MenuItem>
                    <MenuItem value="pass">Pass</MenuItem>
                    <MenuItem value="fail">Fail</MenuItem>
                    <MenuItem value="not-checked">Not Checked</MenuItem>
                </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="contained" onClick={handleApplyFilter} fullWidth>
                    Apply ({filteredElements.length})
                </Button>
                <Button size="small" variant="outlined" onClick={filterStore.resetFilters} fullWidth>
                    Reset
                </Button>
            </Box>
        </Box>
    );
}

// ===== Error Boundary for Spatial Tree =====
class SpatialTreeErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: string }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: '' };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error: error.message || 'Unknown error' };
    }
    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="error" gutterBottom>
                        Could not render spatial tree
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {this.state.error}
                    </Typography>
                </Box>
            );
        }
        return this.props.children;
    }
}

// ===== Main LeftBar =====
export default function LeftBar() {
    const { leftBarTab, setLeftBarTab } = useUIStore();
    const { spatialTree } = useModelStore();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Tabs
                value={leftBarTab}
                onChange={(_, v) => setLeftBarTab(v)}
                variant="fullWidth"
                sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 36 }}
            >
                <Tab label="Spatial" sx={{ minHeight: 36, py: 0 }} />
                <Tab label="Types" sx={{ minHeight: 36, py: 0 }} />
                <Tab label="Search" sx={{ minHeight: 36, py: 0 }} />
            </Tabs>

            <TabPanel value={leftBarTab} index={0}>
                <SpatialTreeErrorBoundary>
                    <List dense>
                        {spatialTree ? (
                            <SpatialTreeNode node={spatialTree} />
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                                No model loaded
                            </Typography>
                        )}
                    </List>
                </SpatialTreeErrorBoundary>
            </TabPanel>

            <TabPanel value={leftBarTab} index={1}>
                <TypeTreeView />
            </TabPanel>

            <TabPanel value={leftBarTab} index={2}>
                <SearchFilterView />
            </TabPanel>
        </Box>
    );
}
