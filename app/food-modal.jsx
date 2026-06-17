import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Image,
    FlatList,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function FoodEntryModal() {
    const db = useSQLiteContext();
    const router = useRouter();
    const params = useLocalSearchParams();
    const {
        date,
        id,
        food_name,
        calories,
        protein,
        carbs,
        fat,
        quantity,
        unit,
        editMode,
        focusOnWeight,
        food_image
    } = params;

    const [isLoading, setIsLoading] = useState(false);
    const [foodQuantity, setFoodQuantity] = useState(quantity || '100');
    const [foodUnit, setFoodUnit] = useState(unit || 'g');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedFood, setSelectedFood] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMoreResults, setHasMoreResults] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [apiSource, setApiSource] = useState('openfoodfacts');
    const [apiStatus, setApiStatus] = useState({ nutritionix: 'unknown' });

    const formatNumber = (num) => {
        return parseFloat(num).toFixed(2);
    };

    useEffect(() => {
        if (focusOnWeight === 'true' && foodQuantity) {
            setFoodQuantity(quantity);
            setFoodUnit(unit);
        }
    }, [quantity, unit, focusOnWeight]);

    const saveFoodEntry = async () => {
        if (!foodQuantity || isNaN(foodQuantity)) return;

        const quantityNum = parseFloat(foodQuantity);
        if (quantityNum <= 0) return;

        try {
            setIsLoading(true);

            if (editMode === 'true') {
                const originalQuantity = parseFloat(quantity);
                const multiplier = quantityNum / originalQuantity;

                await db.runAsync(
                    'UPDATE food_entries SET quantity = ?, unit = ?, calories = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?',
                    [
                        formatNumber(quantityNum),
                        foodUnit,
                        parseFloat(calories) * multiplier,
                        parseFloat(protein) * multiplier,
                        parseFloat(carbs) * multiplier,
                        parseFloat(fat) * multiplier,
                        id
                    ]
                );
            } else {
                const multiplier = quantityNum / (selectedFood.servingWeight || 100);

                await db.runAsync(
                    'INSERT INTO food_entries (date, food_name, calories, protein, carbs, fat, quantity, unit, food_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        date,
                        selectedFood.name,
                        selectedFood.calories * multiplier,
                        selectedFood.protein * multiplier,
                        selectedFood.carbs * multiplier,
                        selectedFood.fat * multiplier,
                        formatNumber(quantityNum),
                        foodUnit,
                        selectedFood.image || null
                    ]
                );
            }

            router.back();
        } catch (error) {
            console.error('Error saving food entry:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const searchFood = async (page = 1) => {
        if (!searchQuery.trim()) {
            setSearchError('');
            return;
        }

        if (page === 1) {
            setIsSearching(true);
            setSearchResults([]);
            setCurrentPage(1);
            setHasMoreResults(true);
            setSearchError(null);
        } else {
            setIsLoadingMore(true);
        }

        try {
            if (apiSource === 'nutritionix') {
                await searchNutritionix(page);
            } else {
                await searchOpenFoodFacts(page);
            }
        } catch (error) {
            console.error('Error searching food:', error);
            setSearchError('Failed to search. Please try again.');
        } finally {
            setIsSearching(false);
            setIsLoadingMore(false);
        }
    };

    const searchOpenFoodFacts = async (page = 1) => {
        try {
            const response = await fetch(
                `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=20&page=${page}&lc=ro&cc=ro&fields=code,product_name,image_url,lang,countries,nutriments`
            );

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();

            if (data.products && data.products.length > 0) {
                const filteredProducts = data.products.filter(product => {
                    const hasCalories = product.nutriments?.['energy-kcal_100g'] > 0 ||
                        (product.nutriments?.['energy-kcal'] > 0);
                    const hasProtein = product.nutriments?.proteins_100g > 0;
                    const hasCarbs = product.nutriments?.carbohydrates_100g > 0;
                    const hasFat = product.nutriments?.fat_100g > 0;

                    return hasCalories && hasProtein && hasCarbs && hasFat;
                });

                const sortedProducts = filteredProducts.sort((a, b) => {
                    const aIsRo = (a.lang === 'ro' || a.countries?.includes('Romania'));
                    const bIsRo = (b.lang === 'ro' || b.countries?.includes('Romania'));

                    if (aIsRo && !bIsRo) return -1;
                    if (!aIsRo && bIsRo) return 1;

                    const aIsEn = a.lang === 'en';
                    const bIsEn = b.lang === 'en';

                    if (aIsEn && !bIsEn) return -1;
                    if (!aIsEn && bIsEn) return 1;

                    return 0;
                });

                const products = sortedProducts.map(product => {
                    const caloriesValue = product.nutriments?.['energy-kcal_100g'] ||
                        (product.nutriments?.['energy-kcal'] ?
                            product.nutriments['energy-kcal'] /
                            (product.nutriments['energy-kcal_unit'] === 'kcal' ? 1 : 1000) : 0);

                    return {
                        id: product.code,
                        name: product.product_name || 'Unknown product',
                        image: product.image_url,
                        calories: parseFloat(caloriesValue) || 0,
                        protein: parseFloat(product.nutriments?.proteins_100g) || 0,
                        carbs: parseFloat(product.nutriments?.carbohydrates_100g) || 0,
                        fat: parseFloat(product.nutriments?.fat_100g) || 0,
                        servingWeight: 100,
                        source: 'OpenFoodFacts',
                        lang: product.lang || 'unknown'
                    };
                });

                setSearchResults(prev => page === 1 ? products : [...prev, ...products]);
                setHasMoreResults(data.count > page * 20);
                setCurrentPage(page);

                if (products.length === 0 && page === 1) {
                    setSearchError('No complete nutrition data found for these products');
                }
            } else {
                setHasMoreResults(false);
                if (page === 1) {
                    setSearchError('No products found');
                }
            }
        } catch (error) {
            console.error('Error searching OpenFoodFacts:', error);
            setHasMoreResults(false);
            setSearchError('Failed to search. Please try again.');
        }
    };

    const searchNutritionix = async (page = 1) => {
        try {
            // First check query length
            if (searchQuery.trim().length < 3) {
                setSearchError('Enter at least 3 characters');
                return;
            }

            setSearchError('');
            setIsSearching(true);

            // Nutritionix Instant Search
            const response = await fetch(
                `https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(searchQuery)}`,
                {
                    headers: {
                        'x-app-id': '07f5e176',
                        'x-app-key': '655648041ca0ceefeaa471e641e46b56',
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json();
                if (error.message?.includes('limits exceeded')) {
                    setApiStatus(prev => ({...prev, nutritionix: 'unavailable'}));
                    setSearchError('Limitele api-ului Nutritionix au fost atinse. Se folosește OpenFoodFacts...');
                    await searchOpenFoodFacts();
                    return;
                }
                throw new Error(error.message || 'Nutritionix API error');
            }

            const data = await response.json();

            if (data.common && data.common.length > 0) {
                // Process first 5 results only (to avoid too many API calls)
                const foodsToProcess = data.common.slice(0, 20);
                const detailedFoods = [];

                for (const food of foodsToProcess) {
                    try {
                        // Get nutrition details for each food
                        const nutritionResponse = await fetch(
                            'https://trackapi.nutritionix.com/v2/natural/nutrients',
                            {
                                method: 'POST',
                                headers: {
                                    'x-app-id': 'c47cfb97',
                                    'x-app-key': '92d34a03e8d93dd9fd4b991271353802',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    query: `100g of ${food.food_name}`
                                })
                            }
                        );

                        if (!nutritionResponse.ok) {
                            const error = await nutritionResponse.json();
                            if (error.message?.includes('limits exceeded')) {
                                setApiStatus(prev => ({...prev, nutritionix: 'unavailable'}));
                                setSearchError('Limitele api-ului Nutritionix au fost atinse. Se folosește OpenFoodFacts...');
                                await searchOpenFoodFacts();
                                return;
                            }
                            continue;
                        }

                        const nutritionData = await nutritionResponse.json();

                        if (nutritionData.foods && nutritionData.foods.length > 0) {
                            const foodItem = nutritionData.foods[0];
                            detailedFoods.push({
                                id: foodItem.food_name + Math.random().toString(36).substring(7), // Unique ID
                                name: foodItem.food_name,
                                image: foodItem.photo?.thumb || null,
                                calories: foodItem.nf_calories || 0,
                                protein: foodItem.nf_protein || 0,
                                carbs: foodItem.nf_total_carbohydrate || 0,
                                fat: foodItem.nf_total_fat || 0,
                                servingWeight: foodItem.serving_weight_grams || 100,
                                source: 'Nutritionix'
                            });
                        }
                    } catch (error) {
                        console.error('Error getting nutrition details:', error);
                        continue;
                    }
                }

                setSearchResults(detailedFoods);
                setApiStatus(prev => ({...prev, nutritionix: 'available'}));

                if (detailedFoods.length === 0) {
                    setSearchError('No nutrition data found. Trying OpenFoodFacts...');
                    await searchOpenFoodFacts();
                }
            } else {
                setSearchError('No foods found. Trying OpenFoodFacts...');
                await searchOpenFoodFacts();
            }
        } catch (error) {
            console.error('Error searching Nutritionix:', error);
            setSearchError('Nutritionix failed. Using OpenFoodFacts...');
            setApiStatus(prev => ({...prev, nutritionix: 'unavailable'}));
            await searchOpenFoodFacts();
        }
    };

    const loadMoreResults = () => {
        if (!isLoadingMore && hasMoreResults && apiSource === 'openfoodfacts') {
            searchFood(currentPage + 1);
        }
    };

    const renderFoodItem = ({ item }) => (
        <TouchableOpacity
            style={styles.foodItem}
            onPress={() => setSelectedFood(item)}
        >
            {(item.image || item.photo) && (
                <Image
                    source={{ uri: item.image || item.photo }}
                    style={styles.foodImage}
                    resizeMode="contain"
                />
            )}
            <View style={styles.foodTextContainer}>
                <Text style={styles.foodName}>{item.name}</Text>
                <Text style={styles.foodSource}>{item.source}</Text>
                <View style={styles.foodDetails}>
                    <Text style={styles.foodDetail}>{(item.calories || 0).toFixed(0)} kcal</Text>
                    <Text style={[styles.foodDetail, { color: '#4CAF50' }]}>
                        P: {(item.protein || 0).toFixed(1)}g
                    </Text>
                    <Text style={[styles.foodDetail, { color: '#2196F3' }]}>
                        C: {(item.carbs || 0).toFixed(1)}g
                    </Text>
                    <Text style={[styles.foodDetail, { color: '#FF5722' }]}>
                        F: {(item.fat || 0).toFixed(1)}g
                    </Text>
                </View>
                <Text style={styles.per100g}>Per {formatNumber(item.servingWeight)}g serving</Text>
            </View>
        </TouchableOpacity>
    );

    const renderFooter = () => {
        if (!isLoadingMore) return null;
        return (
            <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" />
            </View>
        );
    };

    if (focusOnWeight === 'true') {
        return (
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.container}>
                        <Text style={styles.title}>Editează gramajul</Text>

                        <View style={styles.selectedFoodContainer}>
                            {food_image && (
                                <Image
                                    source={{ uri: food_image }}
                                    style={styles.selectedFoodImage}
                                    resizeMode="contain"
                                />
                            )}
                            <Text style={styles.selectedFoodName}>{food_name}</Text>
                            <View style={styles.nutritionFacts}>
                                <View style={styles.nutritionRow}>
                                    <Text style={styles.nutritionLabel}>Calorii:</Text>
                                    <Text style={styles.nutritionValue}>
                                        {(parseFloat(calories) * (parseFloat(foodQuantity) / parseFloat(quantity)) || 0).toFixed(0)} kcal
                                    </Text>
                                </View>
                                <View style={styles.nutritionRow}>
                                    <Text style={[styles.nutritionLabel, { color: '#4CAF50' }]}>Proteine:</Text>
                                    <Text style={styles.nutritionValue}>
                                        {(parseFloat(protein) * (parseFloat(foodQuantity) / parseFloat(quantity)) || 0).toFixed(1)}g
                                    </Text>
                                </View>
                                <View style={styles.nutritionRow}>
                                    <Text style={[styles.nutritionLabel, { color: '#2196F3' }]}>Carbs:</Text>
                                    <Text style={styles.nutritionValue}>
                                        {(parseFloat(carbs) * (parseFloat(foodQuantity) / parseFloat(quantity)) || 0).toFixed(1)}g
                                    </Text>
                                </View>
                                <View style={styles.nutritionRow}>
                                    <Text style={[styles.nutritionLabel, { color: '#FF5722' }]}>Grăsimi:</Text>
                                    <Text style={styles.nutritionValue}>
                                        {(parseFloat(fat) * (parseFloat(foodQuantity) / parseFloat(quantity)) || 0).toFixed(1)}g
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.quantityContainer}>
                            <Text style={styles.quantityLabel}>Gramaj:</Text>
                            <View style={styles.quantityInputContainer}>
                                <TextInput
                                    style={[styles.quantityInput, { height: 50 }]}
                                    keyboardType="numeric"
                                    value={foodQuantity}
                                    onChangeText={setFoodQuantity}
                                    autoFocus={true}
                                    placeholder="Enter quantity"
                                    placeholderTextColor="#999"
                                />
                                <TextInput
                                    style={[styles.unitInput, { height: 50 }]}
                                    value={foodUnit}
                                    onChangeText={setFoodUnit}
                                    placeholder="g, ml, etc."
                                    placeholderTextColor="#999"
                                />
                            </View>
                        </View>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={() => router.back()}
                            >
                                <Text style={styles.buttonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.saveButton]}
                                onPress={saveFoodEntry}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    return (
        <View style={styles.container}>
            {!selectedFood ? (
                <>
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search for food..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={() => searchFood(1)}
                            returnKeyType="search"
                        />
                        <TouchableOpacity
                            style={styles.searchButton}
                            onPress={() => searchFood(1)}
                            disabled={isSearching}
                        >
                            <Text style={styles.searchButtonText}>Search</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.apiToggleContainer}>
                        <TouchableOpacity
                            style={[
                                styles.apiToggleButton,
                                apiSource === 'openfoodfacts' && styles.apiToggleActive
                            ]}
                            onPress={() => setApiSource('openfoodfacts')}
                        >
                            <Text style={[
                                styles.apiToggleText,
                                apiSource === 'openfoodfacts' && styles.apiToggleActiveText
                            ]}>
                                OpenFoodFacts
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.apiToggleButton,
                                apiSource === 'nutritionix' && styles.apiToggleActive
                            ]}
                            onPress={() => setApiSource('nutritionix')}
                        >
                            <Text style={[
                                styles.apiToggleText,
                                apiSource === 'nutritionix' && styles.apiToggleActiveText
                            ]}>
                                Nutritionix
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {searchError && (
                        <Text style={styles.errorText}>{searchError}</Text>
                    )}

                    {isSearching && searchResults.length === 0 ? (
                        <ActivityIndicator size="large" style={styles.loader} />
                    ) : (
                        <FlatList
                            data={searchResults}
                            renderItem={renderFoodItem}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={styles.searchResults}
                            onEndReached={loadMoreResults}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={renderFooter}
                        />
                    )}
                </>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.selectedFoodContainer}>
                        <Text style={styles.selectedFoodName}>{selectedFood.name}</Text>
                        <Text style={styles.foodSource}>{selectedFood.source}</Text>
                        {(selectedFood.image || selectedFood.photo) && (
                            <Image
                                source={{ uri: selectedFood.image || selectedFood.photo }}
                                style={styles.selectedFoodImage}
                                resizeMode="contain"
                            />
                        )}
                        <View style={styles.nutritionFacts}>
                            <View style={styles.nutritionRow}>
                                <Text style={styles.nutritionLabel}>Calorii:</Text>
                                <Text style={styles.nutritionValue}>
                                    {(selectedFood.calories * (parseFloat(foodQuantity) / 100)).toFixed(0)} kcal
                                </Text>
                            </View>
                            <View style={styles.nutritionRow}>
                                <Text style={[styles.nutritionLabel, { color: '#4CAF50' }]}>Proteine:</Text>
                                <Text style={styles.nutritionValue}>
                                    {(selectedFood.protein * (parseFloat(foodQuantity) / 100)).toFixed(1)}g
                                </Text>
                            </View>
                            <View style={styles.nutritionRow}>
                                <Text style={[styles.nutritionLabel, { color: '#2196F3' }]}>Carbs:</Text>
                                <Text style={styles.nutritionValue}>
                                    {(selectedFood.carbs * (parseFloat(foodQuantity) / 100)).toFixed(1)}g
                                </Text>
                            </View>
                            <View style={styles.nutritionRow}>
                                <Text style={[styles.nutritionLabel, { color: '#FF5722' }]}>Grăsimi:</Text>
                                <Text style={styles.nutritionValue}>
                                    {(selectedFood.fat * (parseFloat(foodQuantity) / 100)).toFixed(1)}g
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.quantityContainer}>
                        <Text style={styles.quantityLabel}>Gramaj:</Text>
                        <View style={styles.quantityInputContainer}>
                            <TextInput
                                style={[styles.quantityInput, { height: 50 }]}
                                keyboardType="numeric"
                                value={foodQuantity}
                                onChangeText={setFoodQuantity}
                                placeholder="Enter quantity"
                                placeholderTextColor="#999"
                            />
                            <TextInput
                                style={[styles.unitInput, { height: 50 }]}
                                value={foodUnit}
                                onChangeText={setFoodUnit}
                                placeholder="g, ml, etc."
                                placeholderTextColor="#999"
                            />
                        </View>
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={() => setSelectedFood(null)}
                        >
                            <Text style={styles.buttonText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={saveFoodEntry}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Save </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#F4F4F4FF',
    },
    scrollContainer: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#333',
    },
    searchContainer: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        marginRight: 8,
        fontSize: 16,
        elevation: 2,
    },
    searchButton: {
        backgroundColor: '#bd0c0c',
        padding: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    searchButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    apiToggleContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 16,
    },
    apiToggleButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginHorizontal: 8,
        backgroundColor: '#e0e0e0',
    },
    apiToggleActive: {
        backgroundColor: '#bd0c0c',
    },
    apiToggleText: {
        color: '#333',
    },
    apiToggleActiveText: {
        color: '#fff',
    },
    loader: {
        marginVertical: 20,
    },
    loadingMoreContainer: {
        paddingVertical: 10,
    },
    searchResults: {
        paddingBottom: 16,
    },
    foodItem: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
        elevation: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    foodImage: {
        width: 50,
        height: 50,
        marginRight: 12,
        borderRadius: 4,
    },
    foodTextContainer: {
        flex: 1,
    },
    foodName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#333',
    },
    foodSource: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    foodDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    foodDetail: {
        fontSize: 14,
    },
    per100g: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
        textAlign: 'right',
    },
    selectedFoodContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        elevation: 2,
    },
    selectedFoodImage: {
        width: 100,
        height: 100,
        alignSelf: 'center',
        marginBottom: 12,
        borderRadius: 8,
    },
    selectedFoodName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
        textAlign: 'center',
    },
    nutritionFacts: {
        marginTop: 8,
    },
    nutritionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    nutritionLabel: {
        fontSize: 16,
    },
    nutritionValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    quantityContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        elevation: 2,
    },
    quantityLabel: {
        fontSize: 16,
        marginBottom: 8,
        color: '#333',
    },
    quantityInputContainer: {
        flexDirection: 'row',
    },
    quantityInput: {
        flex: 1,
        backgroundColor: '#F4F4F4FF',
        padding: 12,
        borderRadius: 8,
        marginRight: 8,
        fontSize: 16,
    },
    unitInput: {
        width: 80,
        backgroundColor: '#F4F4F4FF',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    button: {
        flex: 1,
        padding: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    cancelButton: {
        backgroundColor: '#6c757d',
        marginRight: 8,
    },
    saveButton: {
        backgroundColor: '#28a745',
        marginLeft: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginVertical: 10,
    },
});