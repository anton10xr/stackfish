// Efficient implementation of Fenwick 2D

// Note:
// - already included coordinate compression, so any `int` coordinates
//   should work

// Compressor {{{
/* Example usage:
    auto compressor = CompressorBuilder<T>{vs}.build();
    int x = compessor.must_eq(vs[0]);
    compressor.compress_inplace(vs);
*/
// Based on https://suisen-cp.github.io/cp-library-cpp/library/util/coordinate_compressor.hpp
template<typename T>
struct CompressorBuilder {
    // Do not use directly. Use builder.build()
    struct Compressor {
        // Number of unique keys
        int size() const { return xs.size(); }

        void compress_inplace(std::vector<T>& vals) {
            for (int& val : vals) {
                val = must_eq(val);
            }
        }

        [[nodiscard]] std::vector<T> compress(const std::vector<T>& vals) {
            std::vector<T> res(vals.size());
            for (int i = 0; i < static_cast<int> (res.size()); ++i) {
                res[i] = must_eq(vals[i]);
            }
            return res;
        }

        bool has_key(const T& key) const {
            return std::binary_search(xs.begin(), xs.end(), key);
        }

#define LB(key) std::lower_bound(xs.begin(), xs.end(), key)
#define UB(key) std::upper_bound(xs.begin(), xs.end(), key)
        std::optional<int> eq(const T& key) {
            auto it = LB(key);
            return it == xs.end() ? std::nullopt : std::optional<int>{it - xs.begin()};
        }
        std::optional<int> geq(const T& key) {
            auto it = LB(key);
            return it == xs.end() ? std::nullopt : std::optional<int>{it - xs.begin()};
        }
        std::optional<int> gt(const T& key) {
            auto it = UB(key);
            return it == xs.end() ? std::nullopt : std::optional<int>{it - xs.begin()};
        }
        std::optional<int> leq(const T& key) {
            auto it = UB(key);
            return it == xs.begin() ? std::nullopt : std::optional<int>{it - xs.begin() - 1};
        }
        std::optional<int> lt(const T& key) {
            auto it = LB(key);
            return it == xs.begin() ? std::nullopt : std::optional<int>{it - xs.begin() - 1};
        }

        // throw exception if no such key is found
        int must_eq(const T& key) {
            auto it = LB(key);
            assert(it != xs.end());
            return it - xs.begin();
        }
        // throw exception if no such key is found
        int must_geq(const T& key) {
            auto it = LB(key);
            assert(it != xs.end());
            return it - xs.begin();
        }
        // throw exception if no such key is found
        int must_gt(const T& key) {
            auto it = UB(key);
            assert(it != xs.end());
            return it - xs.begin();
        }
        // throw exception if no such key is found
        int must_leq(const T& key) {
            auto it = UB(key);
            assert(it != xs.begin());
            return it - xs.begin() - 1;
        }
        // throw exception if no such key is found
        int must_lt(const T& key) {
            auto it = LB(key);
            assert(it != xs.begin());
            return it - xs.begin() - 1;
        }
#undef LB
#undef UB

        std::vector<T> xs;
    };

    auto build() {
        std::sort(xs.begin(), xs.end());
        xs.erase(std::unique(xs.begin(), xs.end()), xs.end());
        return Compressor{xs};
    }

    void add(const T& key) { xs.push_back(key); }
    void add(T&& key) { xs.push_back(std::move(key)); }

    std::vector<T> xs;
};


const int INF = 2e9 + 11;  // for coordinates
template<typename T>
struct Query {
    static const int ADD = 0;
    static const int QUERY = 1;

    int typ;  // ADD or QUERY
    int x, y;
    int x2, y2;  // for QUERY: [x1, x2-1] * [y1, y2-1]

    T weight;
};

template<typename T>
struct Fenwick2D {
    vector<T> solve(vector<Query<T>> queries) {
        // Get coordinates of ADD queries
        CompressorBuilder<int> cx_builder, cy_builder;
        cx_builder.add(INF);
        cy_builder.add(INF);
        for (const auto& query : queries) {
            if (query.typ == Query<T>::ADD) {
                cx_builder.add(query.x);
                cy_builder.add(query.y);
            }
        }
        auto cx = cx_builder.build();
        auto cy = cy_builder.build();
        sx = cx.size();

        // Compress
        for (auto& query : queries) {
            query.x = cx.must_geq(query.x) + 1;
            query.y = cy.must_geq(query.y) + 1;

            if (query.typ == Query<T>::QUERY) {
                query.x2 = cx.must_geq(query.x2) + 1;
                query.y2 = cy.must_geq(query.y2) + 1;
            }
        }

        // fake updates
        nodes.resize(sx+1);
        f.resize(sx+1);
        for (const auto& query : queries) {
            if (query.typ == Query<T>::ADD) {
                fakeUpdate(query.x, query.y);
            }
        }

        initNodes();

        // answer queries
        vector<T> res;
        for (const auto& query : queries) {
            if (query.typ == Query<T>::ADD) {
                update(query.x, query.y, query.weight);
            } else {
                res.push_back(
                    + get(query.x2 - 1, query.y2 - 1)
                    - get(query.x2 - 1, query.y  - 1)
                    - get(query.x  - 1, query.y2 - 1)
                    + get(query.x  - 1, query.y  - 1)
                );
            }
        }
        return res;
    }

// private:
    // nodes[x] contains all relevant y coordinates
    vector<vector<int>> nodes;
    vector<vector<T>> f;
    int sx;

    void initNodes() {
        for (int i = 1; i <= sx; i++) {
            nodes[i].push_back(INF);
            sort(nodes[i].begin(), nodes[i].end());
            nodes[i].erase(unique(nodes[i].begin(), nodes[i].end()), nodes[i].end());
            f[i].resize(nodes[i].size() + 1);
        }
    }

    void fakeUpdate(int x, int y) {
        for (; x <= sx; x += x & -x)
            nodes[x].push_back(y);
    }

    // point (u, v) += val
    void update(int u, int v, int val) {
        for(int x = u; x <= sx; x += x & -x)
            for(int y = lower_bound(nodes[x].begin(), nodes[x].end(), v) - nodes[x].begin() + 1; y <= (int) nodes[x].size(); y += y & -y)
                f[x][y] += val;
    }

    // Get sum of point in rectangle with corners at (1, 1) and (u, v)
    T get(int u, int v) {
        T res = 0;
        for(int x = u; x > 0; x -= x & -x)
            for(int y = upper_bound(nodes[x].begin(), nodes[x].end(), v) - nodes[x].begin(); y > 0; y -= y & -y)
                res += f[x][y];
        return res;
    }
};