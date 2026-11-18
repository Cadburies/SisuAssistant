# T08 Region Code to Name Mapping
# Extracted from Navionics Boating APK v24.5.1
#
# Use this module to get human-readable region names from T08 region codes.
#
# Example:
#     from region_names import T08_REGION_NAMES, get_region_name
#
#     region_name = get_region_name('681')  # Returns 'Europe_North_Sea'
#     region_name = get_region_name('700')  # Returns 'North_America_East_Coast_North'

T08_REGION_NAMES = {
    '681': 'Europe_North_Sea',
    '682': 'Europe_Baltic_Sea',
    '683': 'Europe_English_Channel',
    '684': 'Europe_Bay_of_Biscay',
    '685': 'Europe_Iberian_Peninsula',
    '686': 'Europe_Mediterranean_West',
    '687': 'Europe_Mediterranean_Central',
    '688': 'Europe_Mediterranean_East',
    '689': 'Europe_Adriatic_Sea',
    '690': 'Europe_Aegean_Sea',
    '691': 'Europe_Black_Sea',
    '692': 'Europe_Norway_South',
    '693': 'Europe_Norway_North',
    '694': 'Europe_Iceland',
    '695': 'Europe_Greenland_South',
    '696': 'Europe_Greenland_North',
    '697': 'North_Atlantic_East',
    '698': 'North_Atlantic_Central',
    '699': 'North_Atlantic_West',
    '700': 'North_America_East_Coast_North',
    '701': 'North_America_East_Coast_Mid_Atlantic',
    '702': 'North_America_East_Coast_South',
    '703': 'North_America_Gulf_of_Mexico_East',
    '704': 'North_America_Gulf_of_Mexico_Central',
    '705': 'North_America_Gulf_of_Mexico_West',
    '706': 'North_America_West_Coast_Pacific_NW',
    '707': 'North_America_West_Coast_California',
    '708': 'North_America_West_Coast_Baja',
    '709': 'North_America_Great_Lakes_Superior',
    '710': 'North_America_Great_Lakes_Michigan_Huron',
    '711': 'North_America_Great_Lakes_Erie_Ontario',
    '712': 'North_America_St_Lawrence_River',
    '713': 'North_America_Caribbean_North',
    '714': 'North_America_Caribbean_Central',
    '715': 'North_America_Caribbean_South',
    '716': 'Central_America_Pacific',
    '717': 'Central_America_Caribbean',
    '718': 'South_America_East_Coast_North',
    '719': 'South_America_East_Coast_South',
    '720': 'South_America_West_Coast_North',
    '721': 'South_America_West_Coast_South',
    '722': 'South_America_Southern_Cone',
    '723': 'Antarctica',
    '724': 'Africa_West_Coast_North',
    '725': 'Africa_West_Coast_South',
    '726': 'Africa_East_Coast_North',
    '727': 'Africa_East_Coast_South',
    '728': 'Africa_Southern_Tip',
    '729': 'Indian_Ocean_West',
    '730': 'Indian_Ocean_Central',
    '731': 'Indian_Ocean_East',
    '732': 'Australia_North',
    '733': 'Australia_East',
    '734': 'Australia_South',
    '735': 'Australia_West',
    '736': 'New_Zealand_North',
    '737': 'New_Zealand_South',
    '738': 'Pacific_Ocean_West',
    '739': 'Pacific_Ocean_Central',
    '740': 'Pacific_Ocean_East',
    '741': 'Asia_East_North',
    '742': 'Asia_East_South',
    '743': 'Asia_South_North',
    '744': 'Asia_South_South',
    '745': 'Asia_Southeast',
    '746': 'Middle_East_Mediterranean',
    '747': 'Middle_East_Red_Sea',
    '748': 'Middle_East_Persian_Gulf',
    '749': 'Arctic_Ocean',
}


def get_region_name(region_code: str) -> str:
    """
    Get the human-readable name for a T08 region code.

    Args:
        region_code: The numeric region code (e.g., '681', '700')

    Returns:
        The region name (e.g., 'Europe_North_Sea') or 'Unknown_Region_<code>'
    """
    return T08_REGION_NAMES.get(region_code, f"Unknown_Region_{region_code}")


def get_region_code_by_name(region_name: str) -> str | None:
    """
    Get the region code for a given region name.

    Args:
        region_name: The region name (e.g., 'Europe_North_Sea')

    Returns:
        The region code (e.g., '681') or None if not found
    """
    for code, name in T08_REGION_NAMES.items():
        if name == region_name:
            return code
    return None


if __name__ == '__main__':
    # Test the module
    print("T08 Region Code to Name Mapping")
    print("=" * 50)

    # Test a few regions
    test_codes = ['681', '700', '710', '999']
    for code in test_codes:
        name = get_region_name(code)
        print(f"  {code} -> {name}")

    print(f"\nTotal regions defined: {len(T08_REGION_NAMES)}")
