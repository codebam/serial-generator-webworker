
import yaml

# Custom constructor to handle the !tags tag
def undefined_constructor(loader, node):
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    elif isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    elif isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node)
    return None

# Add the constructor to the SafeLoader
yaml.SafeLoader.add_constructor('!tags', undefined_constructor)

def parse_serials_with_state_flags(data):
    serials_map = {}
    if data and 'state' in data and 'inventory' in data['state'] and 'items' in data['state']['inventory'] and 'backpack' in data['state']['inventory']['items']:
        backpack_items = data['state']['inventory']['items']['backpack']
        if isinstance(backpack_items, list):
            for item_dict in backpack_items:
                if isinstance(item_dict, dict):
                    serial = item_dict.get('serial')
                    state_flags = item_dict.get('state_flags')
                    if serial:
                        serials_map[serial] = state_flags
        elif isinstance(backpack_items, dict):
            for _, item_dict in backpack_items.items():
                if isinstance(item_dict, dict):
                    serial = item_dict.get('serial')
                    state_flags = item_dict.get('state_flags')
                    if serial:
                        serials_map[serial] = state_flags
    return serials_map

def analyze_serials_comprehensively(original_serials_map, live_serials_map, unknown_serials_set):
    analysis = {
        'new_v3_working': [],
        'new_v3_viewed_valuable': [],
        'new_v3_broken': [],
        'new_v3_unknown': [],
        'new_v3_low_value': [],
        'modified_original_serials': [],
        'removed_original_serials': [],
        'unmodified_original_serials': []
    }

    # Identify NEW (v3) Serials and analyze existing ones
    for serial, live_state_flags in live_serials_map.items():
        if serial not in original_serials_map:
            # This is a new serial (presumably V3 generated)
            if serial in unknown_serials_set:
                analysis['new_v3_unknown'].append(serial)
            elif live_state_flags == 3:
                analysis['new_v3_working'].append(serial)
            elif live_state_flags == 1:
                analysis['new_v3_viewed_valuable'].append(serial)
            elif live_state_flags == 17:
                analysis['new_v3_broken'].append(serial)
            else:
                analysis['new_v3_low_value'].append(serial)
        else:
            # This serial existed in the original save
            original_state_flags = original_serials_map.get(serial)
            if original_state_flags != live_state_flags:
                analysis['modified_original_serials'].append({
                    'serial': serial,
                    'original_state': original_state_flags,
                    'new_state': live_state_flags
                })
            else:
                analysis['unmodified_original_serials'].append(serial)

    # Identify Removed Original Serials
    for serial in original_serials_map:
        if serial not in live_serials_map:
            analysis['removed_original_serials'].append(serial)
            
    return analysis

def main():
    with open('5.yaml', 'r') as f:
        original_data = yaml.safe_load(f)
    original_serials_map = parse_serials_with_state_flags(original_data)
    
    with open('output.yaml', 'r') as f:
        live_data = yaml.safe_load(f)
    
    live_serials_map = parse_serials_with_state_flags(live_data)
    
    unknown_serials_set = set()
    if live_data and 'state' in live_data and 'unknown_items' in live_data['state']:
        unknown_serials_set = set(live_data['state']['unknown_items'])

    analysis_results = analyze_serials_comprehensively(original_serials_map, live_serials_map, unknown_serials_set)
    
    with open('v3_analysis.txt', 'w') as f:
        f.write("V3 Algorithm Comprehensive Analysis:\n")
        f.write("=====================================\n\n")
        
        for category, items in analysis_results.items():
            f.write(f"--- {category.replace('_', ' ').upper()} ({len(items)}) ---\n")
            if category == 'modified_original_serials':
                for item in items:
                    f.write(f"Serial: {item['serial']}, Original State: {item['original_state']}, New State: {item['new_state']}\n")
            else:
                for item in items:
                    f.write(f"{item}\n")
            f.write("\n")

if __name__ == "__main__":
    main()
