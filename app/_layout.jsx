import { Stack } from "expo-router";
import './globals.css';
import { SQLiteProvider } from 'expo-sqlite';
import exercisesData from '../assets/data/exercises';

export default function RootLayout() {
    const initExercises = async (db) => {
        await db.execAsync(`
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    first_launch BOOLEAN DEFAULT 1
                );
            `);


        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS workout_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS workout_template_exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id INTEGER NOT NULL,
                exercise_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                sets_json TEXT,
                duration INTEGER,
                FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
                FOREIGN KEY (exercise_id) REFERENCES exercises(id)
            );
        `);

        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS exercises (
                id INTEGER PRIMARY KEY,
                name TEXT,
                type TEXT,
                muscles TEXT
            );
        `);

        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS workouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                date TEXT
            );
        `);

        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS workout_exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workout_id INTEGER,
                exercise_id INTEGER,
                type TEXT,
                sets_json TEXT,
                duration INTEGER,
                FOREIGN KEY(workout_id) REFERENCES workouts(id),
                FOREIGN KEY(exercise_id) REFERENCES exercises(id)
            );
        `);

        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS calories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                food_name TEXT NOT NULL,
                quantity REAL,
                calories REAL,
                proteins REAL,
                carbs REAL,
                fats REAL
            );
        `);



        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS food_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                food_name TEXT NOT NULL,
                calories REAL NOT NULL,
                protein REAL NOT NULL,
                carbs REAL NOT NULL,
                fat REAL NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL
            );
        `);
        const columns = await db.getAllAsync('PRAGMA table_info(food_entries);');
        const hasImageColumn = columns.some(col => col.name === 'food_image');

        if (!hasImageColumn) {
            await db.execAsync('ALTER TABLE food_entries ADD COLUMN food_image TEXT;');
        }

        // Insert exercises data
        for (const ex of exercisesData.exercises) {
            await db.runAsync(
                'INSERT OR IGNORE INTO exercises (id, name, type, muscles) VALUES (?, ?, ?, ?)',
                [ex.id, ex.name, ex.type, ex.muscles.join(', ')]
            );
        }
    };

    return (
        <SQLiteProvider databaseName="fitness.db" onInit={initExercises}>
            <Stack>
                <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="modal"
                    options={{headerTitle:"",headerShown:false}}
                />
                <Stack.Screen
                    name="template-modal"
                    options={{headerShown:false}}
                />
                <Stack.Screen
                    name="workout-details"
                    options={{headerTitle:"Detalii despre antrenament"}}
                />
                <Stack.Screen
                    name="food-modal"
                    options={{headerTitle:" "}}
                />
                <Stack.Screen
                    name="exerciseprogress-screen"
                    options={{headerTitle:" ",headerShow:false}}
                />
            </Stack>
        </SQLiteProvider>
    );
}