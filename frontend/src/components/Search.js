import React, { useState } from 'react';
import { Box, TextField, Button, Select, MenuItem, FormControl, InputLabel, Grid } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

const Search = ({ onSearch }) => {
    const [searchParams, setSearchParams] = useState({
        query: '',
        subnet: '',
        isContract: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSearchParams(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSearch(searchParams);
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3, mb: 4 }}>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        name="query"
                        label="Rechercher (hash, adresse...)"
                        value={searchParams.query}
                        onChange={handleChange}
                        variant="outlined"
                    />
                </Grid>
                <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                        <InputLabel>Subnet</InputLabel>
                        <Select
                            name="subnet"
                            value={searchParams.subnet}
                            onChange={handleChange}
                            label="Subnet"
                        >
                            <MenuItem value="">Tous</MenuItem>
                            <MenuItem value="C">C-Chain</MenuItem>
                            <MenuItem value="P">P-Chain</MenuItem>
                            <MenuItem value="X">X-Chain</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select
                            name="isContract"
                            value={searchParams.isContract}
                            onChange={handleChange}
                            label="Type"
                        >
                            <MenuItem value="">Tous</MenuItem>
                            <MenuItem value="true">Contrats</MenuItem>
                            <MenuItem value="false">Transactions</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                    <Button
                        fullWidth
                        type="submit"
                        variant="contained"
                        startIcon={<SearchIcon />}
                        sx={{ height: '56px' }}
                    >
                        Rechercher
                    </Button>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Search;
